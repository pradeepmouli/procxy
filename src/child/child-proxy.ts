import type { Request, Response, ChildToParentMessage, ErrorInfo } from '../shared/protocol.js';
import { serializeToJson, deserializeFromJson } from '../shared/serialization.js';
import { EventBridge } from './event-bridge.js';

/**
 * Child-side proxy handler that invokes methods on the target instance
 * and sends responses back to the parent process.
 */
export class ChildProxy {
  private eventBridge?: EventBridge;

  constructor(
    private readonly target: any,
    private readonly send: (message: ChildToParentMessage) => void,
  ) {
    // Set up event forwarding if target is an EventEmitter
    this.eventBridge = new EventBridge(target, send);
    this.eventBridge.setup();
  }

  /**
   * Handle a CALL request from the parent process.
   */
  async handleRequest(message: Request): Promise<void> {
    if (message.type !== 'CALL') return;

    try {
      const method = this.target[message.prop];

      if (typeof method !== 'function') {
        throw new Error(`Method '${message.prop}' does not exist or is not a function`);
      }

      const result = await method.apply(this.target, message.args);
      this.sendSuccess(message.id, result);
    } catch (error) {
      this.sendError(message.id, error as Error);
    }
  }

  private sendSuccess(id: string, value: unknown): void {
    try {
      // Handle void/undefined return values - send null instead
      const valueToSerialize = value === undefined ? null : value;

      const serialized = serializeToJson(valueToSerialize as any, 'response value');
      const deserialized = deserializeFromJson(serialized, 'response value');

      const response: Response = {
        type: 'RESULT',
        id,
        value: deserialized,
      };

      this.send(response);
    } catch (error) {
      this.sendError(id, error as Error);
    }
  }

  private sendError(id: string, error: Error): void {
    const errorInfo: ErrorInfo = {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: (error as any).code,
    };

    const response: Response = {
      type: 'ERROR',
      id,
      error: errorInfo,
    };

    this.send(response);
  }
}
