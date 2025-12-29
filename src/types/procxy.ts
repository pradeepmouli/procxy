import type { ChildProcess } from 'child_process';

/**
 * Procxy<T> — The proxy type that wraps a remote object instance.
 *
 * All methods of T are transformed to async (returning Promise<ReturnType>).
 * Properties are excluded from the proxy.
 *
 * Special lifecycle methods are prefixed with $ to avoid conflicts:
 * - $terminate(): Explicitly terminates the child process
 * - $process: Access to the underlying ChildProcess instance
 *
 * If T extends EventEmitter, the proxy also supports:
 * - .on(event, listener)
 * - .once(event, listener)
 * - .off(event, listener)
 * Note: .emit() is not available on the proxy; events originate from the child.
 *
 * @template T - The original class/interface type
 */
export type Procxy<T> = {
  /**
   * Transform all methods to async.
   * Methods that return void or return types are converted to Promise-returning.
   */
  [K in keyof T]: T[K] extends (...args: infer A) => infer R
    ? (...args: A) => Promise<Awaited<R>>
    : never;
} & {
  /**
   * Explicitly terminate the child process.
   * Subsequent method calls will fail with ChildCrashedError.
   */
  $terminate(): void;

  /**
   * Access to the underlying Node.js ChildProcess instance.
   * Use with caution; modifying the process may break Procxy.
   */
  $process: ChildProcess;
};
