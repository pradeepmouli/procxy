import type { ChildProcess } from 'child_process';
import type { EventEmitter } from 'events';
import type { Jsonifiable } from 'type-fest';

/**
 * Check if a type extends Jsonifiable.
 * Special case: void is considered Jsonifiable (becomes undefined in JSON).
 */
type IsJsonifiable<T> = T extends void ? true : T extends Jsonifiable ? true : false;

/**
 * Check if all parameters in a tuple are Jsonifiable.
 */
type AreParamsJsonifiable<P extends readonly any[]> = P extends readonly []
  ? true
  : P extends readonly [infer First, ...infer Rest]
    ? IsJsonifiable<First> extends true
      ? AreParamsJsonifiable<Rest>
      : false
    : false;

/**
 * Get keys of methods that have Jsonifiable parameters and return values.
 */
type JsonifiableMethodKeys<T> = {
  [K in keyof T]: T[K] extends (...args: infer A) => infer R
    ? AreParamsJsonifiable<A> extends true
      ? IsJsonifiable<Awaited<R>> extends true
        ? K
        : never
      : never
    : never;
}[keyof T];

/**
 * Pick only methods with Jsonifiable parameters and return values.
 */
type JsonifiableMethods<T> = Pick<T, JsonifiableMethodKeys<T>>;

/**
 * Check if an event listener function has Jsonifiable parameters.
 */
type HasJsonifiableEventParams<T> = T extends (...args: infer A) => any
  ? AreParamsJsonifiable<A> extends true
    ? true
    : false
  : false;

/**
 * Check if all event listeners in an EventEmitter event map have Jsonifiable parameters.
 */
type AllEventParamsJsonifiable<E> = {
  [K in keyof E]: HasJsonifiableEventParams<E[K]>;
}[keyof E] extends true
  ? true
  : false;

/**
 * Procxy<T> — The proxy type that wraps a remote object instance.
 *
 * All methods of T are transformed to async (returning Promise<ReturnType>).
 * Only methods with JSON-serializable parameters and return values are included.
 * Properties are excluded from the proxy.
 *
 * Special lifecycle methods are prefixed with $ to avoid conflicts:
 * - $terminate(): Explicitly terminates the child process
 * - $process: Access to the underlying ChildProcess instance
 *
 * If T extends EventEmitter<E>, the proxy also extends EventEmitter<E> with typed methods:
 * - .on(event, listener)
 * - .once(event, listener)
 * - .off(event, listener)
 * - .removeListener(event, listener)
 * Note: .emit() is not available on the proxy; events originate from the child.
 *
 * @template T - The original class/interface type
 */
export type Procxy<T> = {
  /**
   * Transform all Jsonifiable methods to async.
   * Methods with non-Jsonifiable parameters or return values are excluded.
   */
  [K in keyof JsonifiableMethods<T>]: JsonifiableMethods<T>[K] extends (...args: infer A) => infer R
    ? (...args: A) => Promise<Awaited<R>>
    : never;
} & {
  /**
   * Explicitly terminate the child process.
   * Subsequent method calls will fail with ChildCrashedError.
   * @returns Promise that resolves when the child process has terminated
   */
  $terminate(): Promise<void>;

  /**
   * Access to the underlying Node.js ChildProcess instance.
   * Use with caution; modifying the process may break Procxy.
   */
  $process: ChildProcess;
} & (T extends EventEmitter<infer E>
  ? AllEventParamsJsonifiable<E> extends true
    ? {
        /**
         * Add an event listener.
         * @param event - The event name
         * @param listener - The event listener function
         * @returns The proxy instance for chaining
         */
        on<K extends keyof E>(event: K, listener: E[K]): Procxy<T>;
        on(event: string | symbol, listener: (...args: any[]) => void): Procxy<T>;

        /**
         * Add a one-time event listener.
         * @param event - The event name
         * @param listener - The event listener function
         * @returns The proxy instance for chaining
         */
        once<K extends keyof E>(event: K, listener: E[K]): Procxy<T>;
        once(event: string | symbol, listener: (...args: any[]) => void): Procxy<T>;

        /**
         * Remove an event listener.
         * @param event - The event name
         * @param listener - The event listener function to remove
         * @returns The proxy instance for chaining
         */
        off<K extends keyof E>(event: K, listener: E[K]): Procxy<T>;
        off(event: string | symbol, listener: (...args: any[]) => void): Procxy<T>;

        /**
         * Remove an event listener (alias for .off()).
         * @param event - The event name
         * @param listener - The event listener function to remove
         * @returns The proxy instance for chaining
         */
        removeListener<K extends keyof E>(event: K, listener: E[K]): Procxy<T>;
        removeListener(event: string | symbol, listener: (...args: any[]) => void): Procxy<T>;
      }
    : {}
  : {});
