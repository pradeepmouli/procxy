import type { ChildProcess } from 'child_process';
import type { EventEmitter } from 'events';
import type { Jsonifiable, ArrayValues, UnionToIntersection } from 'type-fest';

/**
 * Check if a type extends Jsonifiable or is a function (callback).
 * Special cases:
 * - void is considered valid (becomes undefined in JSON)
 * - undefined is considered valid (for optional parameters)
 * - Function types are considered valid (will be proxied as callbacks)
 * - For union types like (string | undefined), we use [T] to prevent distribution
 *   and check if the entire union is assignable to (Jsonifiable | void | undefined | Function)
 */
type IsJsonifiable<T> = T extends Jsonifiable | void | undefined | Function
  ? true
  : T extends void
    ? true
    : T extends undefined
      ? true
      : false;

/**
 * Check if all parameters in a tuple are Jsonifiable.
 * For optional parameters (e.g., greeting?: string), TypeScript represents them
 * as unions with undefined. We map over numeric indices and check if all are jsonifiable.
 */
type AreParamsJsonifiable<P extends readonly any[]> = UnionToIntersection<
  IsJsonifiable<ArrayValues<P>>
>;

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
 * Extract the event map from an EventEmitter type.
 * EventEmitter<E> internally uses EventMap<E> which we need to extract.
 */
type ExtractEventMap<T> =
  T extends EventEmitter<infer E>
    ? E extends Record<string | symbol, any[]>
      ? { [K in keyof E]: (...args: E[K]) => void }
      : never
    : never;

/**
 * Filter an event map to only include events where the listener
 * parameters are JSON-serializable. This allows partial EventEmitter support
 * where only compatible events are forwarded across process boundaries.
 *
 * TODO: Future enhancement - Support callback proxying
 * Once callback proxy support is implemented, this filter could be relaxed to allow function
 * parameters. Functions would be replaced with callback IDs during serialization and proxied
 * back to the parent process for invocation.
 * See: https://github.com/pradeepmouli/procxy/issues/7
 *
 * @template E - The original event map (record of event name to listener function)
 * @returns A filtered map containing only events with jsonifiable listener parameters
 *
 * @example
 * ```typescript
 * interface MyEvents {
 *   data: (chunk: string) => void;      // ✓ Jsonifiable
 *   error: (err: Error) => void;         // ✓ Jsonifiable (Error serializes to object)
 *   callback: (fn: Function) => void;    // ✗ Not jsonifiable (filtered out)
 * }
 * // Result: { data: ..., error: ... }
 * ```
 */
type JsonifiableEventMap<E extends Record<string | symbol, (...args: any[]) => any>> = {
  [K in keyof E as E[K] extends (...args: infer A) => any
    ? AreParamsJsonifiable<A> extends true
      ? K
      : never
    : never]: E[K];
};

/**
 * Get keys of properties (non-function values) from a type.
 */
type JsonifiablePropertyKeys<T> = {
  [K in keyof T]: T[K] extends (...args: any[]) => any
    ? never
    : T[K] extends Jsonifiable
      ? K
      : never;
}[keyof T];

/**
 * Get readonly properties from the type (excluding methods).
 * Properties are read-only on the proxy - only the child can modify them.
 */
type ReadonlyProperties<T> = {
  readonly [K in JsonifiablePropertyKeys<T>]: T[K];
};

/**
 * Procxy<T> — The proxy type that wraps a remote object instance.
 *
 * All methods of T are transformed to async (returning Promise<ReturnType>).
 * Only methods with JSON-serializable parameters and return values are included.
 * Properties are included as read-only - they can be read but not set from the parent.
 * To modify properties, use methods provided by the child class.
 *
 * Special lifecycle methods are prefixed with $ to avoid conflicts:
 * - $terminate(): Explicitly terminates the child process
 * - $process: Access to the underlying ChildProcess instance
 *
 * Disposable Protocol:
 * - [Symbol.dispose](): Synchronously terminate (calls $terminate() but doesn't await)
 * - [Symbol.asyncDispose](): Asynchronously terminate (awaits $terminate())
 * - Enables `using` and `await using` statements for automatic cleanup
 *
 * If T extends EventEmitter<E>, the proxy also extends EventEmitter<E> with typed methods:
 * - .on(event, listener)
 * - .once(event, listener)
 * - .off(event, listener)
 * - .removeListener(event, listener)
 * Note: .emit() is not available on the proxy; events originate from the child.
 *
 * @template T - The original class/interface type
 *
 * @example
 * ```typescript
 * // Using async disposable (recommended)
 * await using proxy = await procxy(Calculator, { modulePath });
 * const result = await proxy.add(1, 2);
 * // Automatically cleaned up when block exits
 * ```
 *
 * @example
 * ```typescript
 * // Using disposable (sync cleanup)
 * using proxy = await procxy(Calculator, { modulePath });
 * const result = await proxy.add(1, 2);
 * // Cleanup triggered synchronously
 * ```
 */
export type Procxy<T> = {
  /**
   * Transform all Jsonifiable methods to async.
   * Methods with non-Jsonifiable parameters or return values are excluded.
   */
  [K in keyof JsonifiableMethods<T>]: JsonifiableMethods<T>[K] extends (...args: infer A) => infer R
    ? (...args: A) => Promise<Awaited<R>>
    : never;
} & ReadonlyProperties<T> & {
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

    /**
     * Synchronous dispose for `using` statements.
     * Initiates termination but does not wait for completion.
     * For guaranteed cleanup, use Symbol.asyncDispose instead.
     */
    [Symbol.dispose](): void;

    /**
     * Asynchronous dispose for `await using` statements.
     * Awaits full termination of the child process.
     * @returns Promise that resolves when the child process has terminated
     */
    [Symbol.asyncDispose](): Promise<void>;
  } & (T extends EventEmitter<infer E>
    ? E extends Record<string | symbol, any[]>
      ? // EventEmitter with typed event map - always provide methods
        {
          on<K extends keyof JsonifiableEventMap<ExtractEventMap<T>>>(
            event: K,
            listener: JsonifiableEventMap<ExtractEventMap<T>>[K]
          ): Procxy<T>;
          on(event: string | symbol, listener: (...args: any[]) => void): Procxy<T>;
          once<K extends keyof JsonifiableEventMap<ExtractEventMap<T>>>(
            event: K,
            listener: JsonifiableEventMap<ExtractEventMap<T>>[K]
          ): Procxy<T>;
          once(event: string | symbol, listener: (...args: any[]) => void): Procxy<T>;
          off<K extends keyof JsonifiableEventMap<ExtractEventMap<T>>>(
            event: K,
            listener: JsonifiableEventMap<ExtractEventMap<T>>[K]
          ): Procxy<T>;
          off(event: string | symbol, listener: (...args: any[]) => void): Procxy<T>;
          removeListener<K extends keyof JsonifiableEventMap<ExtractEventMap<T>>>(
            event: K,
            listener: JsonifiableEventMap<ExtractEventMap<T>>[K]
          ): Procxy<T>;
          removeListener(event: string | symbol, listener: (...args: any[]) => void): Procxy<T>;
        }
      : {
          // EventEmitter without typed event map - provide untyped methods
          on(event: string | symbol, listener: (...args: any[]) => void): Procxy<T>;
          once(event: string | symbol, listener: (...args: any[]) => void): Procxy<T>;
          off(event: string | symbol, listener: (...args: any[]) => void): Procxy<T>;
          removeListener(event: string | symbol, listener: (...args: any[]) => void): Procxy<T>;
        }
    : T extends EventEmitter
      ? {
          // Plain EventEmitter (no generic parameter)
          on(event: string | symbol, listener: (...args: any[]) => void): Procxy<T>;
          once(event: string | symbol, listener: (...args: any[]) => void): Procxy<T>;
          off(event: string | symbol, listener: (...args: any[]) => void): Procxy<T>;
          removeListener(event: string | symbol, listener: (...args: any[]) => void): Procxy<T>;
        }
      : {});
