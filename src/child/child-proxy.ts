import type {
  Request,
  Response,
  ChildToParentMessage,
  ErrorInfo,
  CallbackInvoke,
  CallbackResult,
  CallbackError,
  PropertySet,
  PropertyResult
} from '../shared/protocol.js';
import type { SerializationMode } from '../types/options.js';
import {
  serializeToJson,
  deserializeFromJson,
  isSerializedCallback
} from '../shared/serialization.js';
import { EventBridge } from './event-bridge.js';
import { randomUUID } from 'node:crypto';

/**
 * Child-side proxy handler that invokes methods on the target instance
 * and sends responses back to the parent process.
 */
export class ChildProxy {
  private eventBridge?: EventBridge;
  private readonly pendingCallbacks = new Map<
    string,
    {
      resolve: (value: any) => void;
      reject: (error: Error) => void;
    }
  >();
  private readonly pendingProperties = new Map<
    string,
    {
      resolve: (value: any) => void;
      reject: (error: Error) => void;
    }
  >();
  private proxiedTarget: any;

  constructor(
    private readonly target: any,
    private readonly send: (message: ChildToParentMessage) => void,
    private readonly serializationMode: SerializationMode = 'json'
  ) {
    // Create a proxy that intercepts property access
    this.proxiedTarget = new Proxy(target, {
      get: (target, prop) => {
        // Check if it's a method
        const value = target[prop];
        if (typeof value === 'function') {
          // It's a method - return it bound to target
          return value.bind(target);
        }

        // It's a property - get from parent's property store
        // This is synchronous access, but we need async IPC
        // For now, just return the target's value directly
        // TODO: Make property access async
        return value;
      },

      set: (target, prop, value) => {
        if (typeof prop !== 'string') {
          return false;
        }

        // Send property set to parent
        const message: PropertySet = {
          type: 'PROPERTY_SET',
          prop,
          value
        };
        this.send(message);

        // Also set locally on target
        target[prop] = value;
        return true;
      }
    });

    // Set up event forwarding if target is an EventEmitter
    this.eventBridge = new EventBridge(this.proxiedTarget, send);
    this.eventBridge.setup();
  }

  /**
   * Handle a CALL request from the parent process.
   */
  async handleRequest(message: Request): Promise<void> {
    if (message.type !== 'CALL') return;

    try {
      // Capture property state before method call
      const propsBefore = this.capturePublicProperties();

      const method = this.proxiedTarget[message.prop];

      if (typeof method !== 'function') {
        throw new Error(`Method '${message.prop}' does not exist or is not a function`);
      }

      // Deserialize arguments, converting callback markers to proxy functions
      const deserializedArgs = message.args.map((arg) => this.deserializeArg(arg));

      const result = await method.apply(this.proxiedTarget, deserializedArgs);

      // Capture property state after method call
      const propsAfter = this.capturePublicProperties();

      // Send back any property changes
      this.sendPropertyUpdates(propsBefore, propsAfter);

      this.sendSuccess(message.id, result);
    } catch (error) {
      this.sendError(message.id, error as Error);
    }
  }

  /**
   * Capture all public (non-function) properties from the target.
   */
  private capturePublicProperties(): Map<string, any> {
    const props = new Map<string, any>();

    for (const key in this.target) {
      const value = this.target[key];
      if (typeof value !== 'function') {
        props.set(key, value);
      }
    }

    return props;
  }

  /**
   * Send property updates that changed between before/after states.
   */
  private sendPropertyUpdates(before: Map<string, any>, after: Map<string, any>): void {
    for (const [prop, afterValue] of after) {
      const beforeValue = before.get(prop);

      // Only send if the value actually changed
      if (beforeValue !== afterValue) {
        const message: PropertySet = {
          type: 'PROPERTY_SET',
          prop,
          value: afterValue
        };
        this.send(message);
      }
    }
  }

  /**
   * Deserialize an argument, converting SerializedCallback to proxy function.
   */
  private deserializeArg(arg: any): any {
    if (isSerializedCallback(arg)) {
      // Create a proxy function that invokes the callback on the parent
      return async (...args: any[]) => {
        try {
          return await this.invokeCallback(arg.__callbackId, args);
        } catch (error: unknown) {
          const callbackId = arg.__callbackId;
          if (error instanceof Error) {
            error.message = `Error invoking callback ${callbackId}: ${error.message}`;
            throw error;
          }
          throw new Error(`Error invoking callback ${callbackId}: ${String(error)}`);
        }
      };
    }

    if (Array.isArray(arg)) {
      return arg.map((item) => this.deserializeArg(item));
    }

    if (arg && typeof arg === 'object' && arg.constructor === Object) {
      const result: any = {};
      for (const [key, value] of Object.entries(arg)) {
        result[key] = this.deserializeArg(value);
      }
      return result;
    }

    return arg;
  }

  /**
   * Invoke a callback on the parent process.
   */
  private async invokeCallback(callbackId: string, args: any[]): Promise<any> {
    const id = randomUUID();

    return new Promise((resolve, reject) => {
      // Store pending callback
      this.pendingCallbacks.set(id, { resolve, reject });

      // Send invoke message
      const message: CallbackInvoke = {
        type: 'CALLBACK_INVOKE',
        id,
        callbackId,
        args
      };

      this.send(message);
    });
  }

  /**
   * Handle callback response from parent.
   */
  handleCallbackResponse(message: CallbackResult | CallbackError): void {
    const pending = this.pendingCallbacks.get(message.id);

    if (!pending) {
      // Response for unknown callback - ignore
      return;
    }

    this.pendingCallbacks.delete(message.id);

    if (message.type === 'CALLBACK_RESULT') {
      pending.resolve(message.value);
    } else {
      const error = new Error(message.error.message);
      error.name = message.error.name;
      error.stack = message.error.stack;
      pending.reject(error);
    }
  }

  /**
   * Handle property result from parent.
   */
  handlePropertyResult(message: PropertyResult): void {
    const pending = this.pendingProperties.get(message.id);

    if (!pending) {
      // Response for unknown property - ignore
      return;
    }

    this.pendingProperties.delete(message.id);
    pending.resolve(message.value);
  }

  private sendSuccess(id: string, value: unknown): void {
    try {
      // Handle void/undefined return values - send null instead
      const valueToSerialize = value === undefined ? null : value;

      // In JSON mode, validate by round-tripping through JSON
      // In advanced mode, skip validation - Node.js handles V8 serialization
      if (this.serializationMode === 'json') {
        const serialized = serializeToJson(valueToSerialize as any, 'response value');
        const deserialized = deserializeFromJson(serialized, 'response value');

        const response: Response = {
          type: 'RESULT',
          id,
          value: deserialized
        };

        this.send(response);
      } else {
        // Advanced mode - Node.js will handle V8 serialization
        const response: Response = {
          type: 'RESULT',
          id,
          value: valueToSerialize
        };

        this.send(response);
      }
    } catch (error) {
      this.sendError(id, error as Error);
    }
  }

  private sendError(id: string, error: Error): void {
    const errorInfo: ErrorInfo = {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: (error as any).code
    };

    const response: Response = {
      type: 'ERROR',
      id,
      error: errorInfo
    };

    this.send(response);
  }

  /**
   * Clean up the target instance if it implements disposable protocol.
   * Calls Symbol.asyncDispose or Symbol.dispose if available.
   */
  async dispose(): Promise<void> {
    // Try async dispose first
    if (typeof this.target[Symbol.asyncDispose] === 'function') {
      await this.target[Symbol.asyncDispose]();
      return;
    }

    // Fall back to sync dispose
    if (typeof this.target[Symbol.dispose] === 'function') {
      this.target[Symbol.dispose]();
      return;
    }

    // No disposable implementation - nothing to do
  }

  /**
   * Subscribe to an event (start forwarding it to parent).
   */
  subscribeEvent(eventName: string): void {
    this.eventBridge?.subscribeEvent(eventName);
  }

  /**
   * Unsubscribe from an event (stop forwarding it to parent).
   */
  unsubscribeEvent(eventName: string): void {
    this.eventBridge?.unsubscribeEvent(eventName);
  }
}
