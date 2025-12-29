import type { ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import type { Jsonifiable } from 'type-fest';
import type { Request, Response, EventMessage, ChildToParentMessage } from '../shared/protocol.js';
import { TimeoutError, ChildCrashedError } from '../shared/errors.js';
import { EventEmitter } from 'node:events';

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
 * - Event forwarding from child
 * - Error propagation
 */
export class IPCClient extends EventEmitter {
  private readonly pendingRequests = new Map<string, PendingRequest>();
  private readonly timeout: number;
  private readonly retries: number;
  private isTerminated = false;

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
    args: Jsonifiable[],
    attemptNumber: number = 0
  ): Promise<Jsonifiable> {
    if (this.isTerminated) {
      throw new Error('Child process has been terminated');
    }

    const id = randomUUID();
    const request: Request = {
      type: 'CALL',
      id,
      prop: method,
      args: [...args]
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
    } else if (message.type === 'EVENT') {
      this.handleEvent(message);
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
      const error = new Error(response.error?.message ?? 'Unknown error');
      error.name = response.error?.name ?? 'Error';
      error.stack = response.error?.stack;
      (error as any).code = response.error?.code;

      pending.reject(error);
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
  }

  /**
   * Terminate the IPC client and child process.
   */
  async terminate(): Promise<void> {
    if (this.isTerminated) {
      return;
    }

    this.isTerminated = true;

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
}
