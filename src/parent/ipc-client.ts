import type { ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import type { Jsonifiable } from 'type-fest';
import type {
  Request,
  Response,
  EventMessage,
  ChildToParentMessage,
  ErrorInfo,
  DisposeRequest,
  EventSubscribe,
  EventUnsubscribe,
  CallbackInvoke,
  CallbackResult,
  CallbackError,
  PropertyGet,
  PropertySet,
  PropertyResult
} from '../shared/protocol.js';
import { TimeoutError, ChildCrashedError } from '../shared/errors.js';
import { EventEmitter } from 'node:events';
import { CallbackRegistry, serializeWithCallbacks } from '../shared/serialization.js';
/**
 * Pending request tracking.
 */
interface PendingRequest {
  resolve: (value: Jsonifiable) => void;
  reject: (error: Error) => void;
  method: string;
  timeoutId?: NodeJS.Timeout;
}

/**
 * IPC client for parent-child communication.
 *
 * Handles:
 * - Request/response correlation via UUID
 * - Promise-based method invocation
 * - Timeout handling with retries
 * - Event forwarding from child (with subscription optimization)
 * - Callback proxying
 * - Error propagation
 */
export class IPCClient extends EventEmitter {
  private readonly pendingRequests = new Map<string, PendingRequest>();
  private readonly callbackRegistry = new CallbackRegistry();
  private readonly propertyStore = new Map<string, Jsonifiable>();
  private readonly timeout: number;
  private readonly retries: number;
  private isTerminated = false;
  private readonly subscribedEvents = new Set<string | symbol>();

  constructor(
    private readonly childProcess: ChildProcess,
    timeout: number = 30000,
    retries: number = 3
  ) {
    super();
    this.timeout = timeout;
    this.retries = retries;

    // Set up message handler
    this.childProcess.on('message', this.handleMessage.bind(this));

    // Set up exit handler
    this.childProcess.on('exit', this.handleExit.bind(this));

    // Override EventEmitter methods to track subscriptions
    this.setupEventTracking();
  }

  get process(): ChildProcess {
    return this.childProcess;
  }

  /**
   * Set up event listener tracking to optimize IPC usage.
   * Only forwards events from child when there are listeners on the parent.
   */
  private setupEventTracking(): void {
    const originalOn = this.on.bind(this);
    const originalOnce = this.once.bind(this);
    const originalOff = this.off.bind(this);
    const originalRemoveListener = this.removeListener.bind(this);
    const originalRemoveAllListeners = this.removeAllListeners.bind(this);

    // Override on() to track subscriptions
    this.on = (event: string | symbol, listener: (...args: any[]) => void): this => {
      const hadListeners = this.listenerCount(event) > 0;
      const result = originalOn(event, listener);

      // If this is the first listener for this event, subscribe in child
      if (!hadListeners && this.listenerCount(event) === 1) {
        this.subscribeInChild(event);
      }

      return result;
    };

    // Override once() to track subscriptions
    this.once = (event: string | symbol, listener: (...args: any[]) => void): this => {
      const hadListeners = this.listenerCount(event) > 0;
      const result = originalOnce(event, listener);

      // If this is the first listener for this event, subscribe in child
      if (!hadListeners && this.listenerCount(event) > 0) {
        this.subscribeInChild(event);
      }

      return result;
    };

    // Override off() to track unsubscriptions
    this.off = (event: string | symbol, listener: (...args: any[]) => void): this => {
      const result = originalOff(event, listener);

      // If no more listeners for this event, unsubscribe in child
      if (this.listenerCount(event) === 0) {
        this.unsubscribeInChild(event);
      }

      return result;
    };

    // Override removeListener() (alias for off)
    this.removeListener = (event: string | symbol, listener: (...args: any[]) => void): this => {
      const result = originalRemoveListener(event, listener);

      // If no more listeners for this event, unsubscribe in child
      if (this.listenerCount(event) === 0) {
        this.unsubscribeInChild(event);
      }

      return result;
    };

    // Override removeAllListeners() to track bulk unsubscriptions
    this.removeAllListeners = (event?: string | symbol): this => {
      if (event) {
        // Removing all listeners for specific event
        const hadListeners = this.listenerCount(event) > 0;
        const result = originalRemoveAllListeners(event);

        if (hadListeners) {
          this.unsubscribeInChild(event);
        }

        return result;
      } else {
        // Removing all listeners for all events
        const events = this.eventNames();
        const result = originalRemoveAllListeners();

        for (const evt of events) {
          this.unsubscribeInChild(evt);
        }

        return result;
      }
    };
  }

  /**
   * Send EVENT_SUBSCRIBE message to child to start forwarding an event.
   */
  private subscribeInChild(event: string | symbol): void {
    if (this.isTerminated) {
      return;
    }

    // Only subscribe once per event
    if (this.subscribedEvents.has(event)) {
      return;
    }

    this.subscribedEvents.add(event);

    const eventName = typeof event === 'symbol' ? event.toString() : event;
    const message: EventSubscribe = {
      type: 'EVENT_SUBSCRIBE',
      eventName
    };

    this.childProcess.send(message);
  }

  /**
   * Send EVENT_UNSUBSCRIBE message to child to stop forwarding an event.
   */
  private unsubscribeInChild(event: string | symbol): void {
    if (this.isTerminated) {
      return;
    }

    // Only unsubscribe if currently subscribed
    if (!this.subscribedEvents.has(event)) {
      return;
    }

    this.subscribedEvents.delete(event);

    const eventName = typeof event === 'symbol' ? event.toString() : event;
    const message: EventUnsubscribe = {
      type: 'EVENT_UNSUBSCRIBE',
      eventName
    };

    this.childProcess.send(message);
  }

  /**
   * Send a method invocation request to the child process.
   * Returns a promise that resolves with the return value or rejects with an error.
   *
   * @param method - Method name to invoke
   * @param args - Method arguments (must be Jsonifiable)
   * @param attemptNumber - Current attempt number (for retry logic)
   */
  async sendRequest(
    method: string,
    args: [...Jsonifiable[]],
    attemptNumber: number = 0
  ): Promise<Jsonifiable> {
    if (this.isTerminated) {
      throw new Error('Child process has been terminated');
    }

    const id = randomUUID();

    // Serialize arguments with callback support
    const serializedArgs = args.map((arg) => serializeWithCallbacks(arg, this.callbackRegistry));

    const request: Request = {
      type: 'CALL',
      id,
      prop: method,
      args: serializedArgs
    };

    return new Promise((resolve, reject) => {
      // Create timeout
      const timeoutId = setTimeout(() => {
        this.pendingRequests.delete(id);

        // Check if we should retry
        if (attemptNumber < this.retries) {
          // Retry the request
          this.sendRequest(method, args, attemptNumber + 1)
            .then(resolve)
            .catch(reject);
        } else {
          // Max retries reached
          reject(new TimeoutError(method, this.timeout));
        }
      }, this.timeout);

      // Store pending request
      this.pendingRequests.set(id, {
        resolve,
        reject,
        method,
        timeoutId
      });

      // Send request to child
      this.childProcess.send(request);
    });
  }

  /**
   * Handle incoming messages from child process.
   */
  private handleMessage(message: ChildToParentMessage): void {
    if (message.type === 'RESULT' || message.type === 'ERROR') {
      this.handleResponse(message);
      return;
    }

    if (message.type === 'EVENT') {
      this.handleEvent(message);
      return;
    }

    if (message.type === 'CALLBACK_INVOKE') {
      this.handleCallbackInvoke(message);
      return;
    }

    if (message.type === 'PROPERTY_GET') {
      this.handlePropertyGet(message);
      return;
    }

    if (message.type === 'PROPERTY_SET') {
      this.handlePropertySet(message);
      return;
    }

    if (message.type === 'INIT_SUCCESS') {
      this.emit('init_success');
      return;
    }

    if (message.type === 'INIT_FAILURE') {
      this.emit('init_failure', this.toError(message.error));
      return;
    }

    if (message.type === 'DISPOSE') {
      // Child initiated disposal - terminate gracefully
      void this.terminate();
      return;
    }
  }

  /**
   * Handle response messages (RESULT or ERROR).
   */
  private handleResponse(response: Response): void {
    const pending = this.pendingRequests.get(response.id);

    if (!pending) {
      // Response for unknown request - ignore
      return;
    }

    // Clear timeout
    if (pending.timeoutId) {
      clearTimeout(pending.timeoutId);
    }

    // Remove from pending
    this.pendingRequests.delete(response.id);

    // Resolve or reject
    if (response.type === 'RESULT') {
      pending.resolve(response.value ?? null);
    } else {
      // Reconstruct error from ErrorInfo
      pending.reject(this.toError(response.error));
    }
  }

  /**
   * Handle event messages from child.
   */
  private handleEvent(message: EventMessage): void {
    // Forward to EventEmitter
    this.emit(message.eventName, ...message.args);
  }

  /**
   * Handle callback invocation from child.
   */
  private async handleCallbackInvoke(message: CallbackInvoke): Promise<void> {
    const callback = this.callbackRegistry.get(message.callbackId);

    if (!callback) {
      // Callback not found - send error
      const errorResponse: CallbackError = {
        id: message.id,
        type: 'CALLBACK_ERROR',
        error: {
          name: 'Error',
          message: `Callback ${message.callbackId} not found`,
          stack: undefined
        }
      };
      this.childProcess.send(errorResponse);
      return;
    }

    try {
      // Invoke the callback
      const result = await callback(...message.args);

      // Send success response
      const successResponse: CallbackResult = {
        id: message.id,
        type: 'CALLBACK_RESULT',
        value: result ?? null
      };
      this.childProcess.send(successResponse);
    } catch (error) {
      // Send error response
      const errorResponse: CallbackError = {
        id: message.id,
        type: 'CALLBACK_ERROR',
        error: {
          name: error instanceof Error ? error.name : 'Error',
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        }
      };
      this.childProcess.send(errorResponse);
    }
  }

  /**
   * Handle property get request from child.
   */
  private handlePropertyGet(message: PropertyGet): void {
    // Get value from property store (undefined if not set)
    const value = this.propertyStore.get(message.prop) ?? null;

    const response: PropertyResult = {
      id: message.id,
      type: 'PROPERTY_RESULT',
      value
    };

    this.childProcess.send(response);
  }

  /**
   * Handle property set message from child.
   * Updates the parent's property store with the new value.
   */
  private handlePropertySet(message: PropertySet): void {
    this.propertyStore.set(message.prop, message.value);
  }

  /**
   * Check if a property exists in the property store.
   */
  hasProperty(prop: string): boolean {
    return this.propertyStore.has(prop);
  }

  /**
   * Get a property value from the property store synchronously.
   */
  getPropertySync(prop: string): Jsonifiable {
    return this.propertyStore.get(prop) ?? null;
  }

  /**
   * Handle child process exit.
   */
  private handleExit(code: number | null, signal: NodeJS.Signals | null): void {
    this.isTerminated = true;

    // Reject all pending requests
    const error = new ChildCrashedError(code, signal);

    for (const [_id, pending] of this.pendingRequests.entries()) {
      if (pending.timeoutId) {
        clearTimeout(pending.timeoutId);
      }
      pending.reject(error);
    }

    this.pendingRequests.clear();

    this.emit('child_exit', code, signal);
  }

  /**
   * Send a handle (socket, server, or file descriptor) to the child process.
   * The handle is transferred (not cloned) to the child.
   *
   * @param handle - The handle to send
   * @param handleId - Unique identifier for the handle
   * @returns Promise that resolves when handle is acknowledged by child
   */
  async sendHandle(
    handle: import('net').Socket | import('net').Server | import('dgram').Socket | number,
    handleId: string = randomUUID()
  ): Promise<void> {
    if (this.isTerminated) {
      throw new Error('Child process has been terminated');
    }

    // Determine handle type
    let handleType: 'socket' | 'server' | 'dgram' | 'fd';
    if (typeof handle === 'number') {
      handleType = 'fd';
    } else if ('listen' in handle && typeof handle.listen === 'function') {
      handleType = 'server';
    } else if ('send' in handle && 'bind' in handle) {
      handleType = 'dgram';
    } else {
      handleType = 'socket';
    }

    const message: import('../shared/protocol.js').HandleMessage = {
      type: 'HANDLE',
      handleId,
      handleType
    };

    // Send message with handle
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Handle send timeout after ${this.timeout}ms`));
      }, this.timeout);

      // Wait for acknowledgment
      const ackHandler = (msg: ChildToParentMessage) => {
        if (msg.type === 'HANDLE_ACK' && msg.handleId === handleId) {
          clearTimeout(timeoutId);
          this.childProcess.off('message', ackHandler);

          if (msg.received) {
            resolve();
          } else {
            reject(new Error(msg.error ?? 'Handle transfer failed'));
          }
        }
      };

      this.childProcess.on('message', ackHandler);

      // Send handle via Node.js IPC
      // Cast handle to SendHandle type (Node.js doesn't accept raw file descriptors via send())
      const sendHandle = typeof handle === 'number' ? undefined : handle;

      if (typeof handle === 'number') {
        // File descriptors can't be sent directly, only sockets/servers
        reject(
          new Error(
            'File descriptor handles are not supported via IPC. Use socket or server instead.'
          )
        );
        clearTimeout(timeoutId);
        this.childProcess.off('message', ackHandler);
        return;
      }

      this.childProcess.send(message, sendHandle, (error) => {
        if (error) {
          clearTimeout(timeoutId);
          this.childProcess.off('message', ackHandler);
          reject(error);
        }
      });
    });
  }

  /**
   * Terminate the IPC client and child process.
   * Sends DISPOSE message to child to trigger cleanup of remote object if it implements disposable.
   */
  async terminate(): Promise<void> {
    // Remove message listener to prevent memory leaks
    this.childProcess.off('message', this.handleMessage);

    if (this.isTerminated) {
      return;
    }

    this.isTerminated = true;

    // Try to dispose remote object gracefully before killing process
    try {
      if (this.childProcess.connected && !this.childProcess.killed) {
        const disposeRequest: DisposeRequest = { type: 'DISPOSE' };

        // Send dispose message
        this.childProcess.send(disposeRequest);

        // Wait for dispose response or timeout after 1 second
        await Promise.race([
          new Promise<void>((resolve) => {
            const handler = (msg: ChildToParentMessage) => {
              if (msg.type === 'DISPOSE_COMPLETE') {
                this.childProcess.off('message', handler);
                resolve();
              }
            };
            this.childProcess.on('message', handler);
          }),
          new Promise<void>((resolve) => setTimeout(resolve, 1000))
        ]);
      }
    } catch {
      // Ignore errors during disposal - we'll kill the process anyway
    }

    // Clear all pending requests
    for (const [_id, pending] of this.pendingRequests.entries()) {
      if (pending.timeoutId) {
        clearTimeout(pending.timeoutId);
      }
      pending.reject(new Error('Child process terminated'));
    }
    this.pendingRequests.clear();

    // Kill child process
    this.childProcess.kill();

    // Wait for exit
    return new Promise((resolve) => {
      if (!this.childProcess.connected) {
        resolve();
        return;
      }

      this.childProcess.once('exit', () => {
        resolve();
      });

      // Force kill after 5 seconds
      setTimeout(() => {
        this.childProcess.kill('SIGKILL');
        resolve();
      }, 5000);
    });
  }

  private toError(info?: ErrorInfo): Error {
    const error = new Error(info?.message ?? 'Unknown error');
    error.name = info?.name ?? 'Error';
    error.stack = info?.stack;
    (error as any).code = info?.code;
    return error;
  }
}
