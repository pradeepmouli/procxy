import type { ChildProcess } from 'child_process';
import type { EventEmitter } from 'events';
import type { Jsonifiable, ArrayValues, UnionToIntersection, Constructor } from 'type-fest';
import type { SerializationMode } from './options.js';
import type { V8Serializable } from '../shared/serialization.js';

/**
 * The serializable type constraint for a given IPC mode.
 *
 * @remarks
 * - `'json'` mode: resolves to `Jsonifiable` (type-fest) — plain objects, arrays, primitives
 * - `'advanced'` mode: resolves to {@link V8Serializable} — adds Buffer, TypedArray, Map, Set, BigInt, Date, RegExp, Error
 *
 * Used as the upper-bound constraint for method parameter and return value types when
 * computing which methods appear on {@link Procxy}.
 *
 * @typeParam Mode - The active serialization mode
 * @category Types
 */
export type Procxiable<Mode extends SerializationMode> = Mode extends 'advanced'
  ? V8Serializable
  : Jsonifiable;

/**
 * Validate that a type is serializable for the given mode; produces a descriptive type error if not.
 */
type ValidateProcxiable<T, Mode extends SerializationMode> =
  T extends Procxiable<Mode>
    ? T
    : {
        error: 'Type is not serializable';
        expected: Procxiable<Mode>;
        received: T;
      };

/**
 * Constrain constructor argument types to be serializable under the given mode.
 *
 * @remarks
 * Applies `ValidateProcxiable` to each position of `ConstructorParameters<T>`.
 * If a constructor argument type is not serializable for the chosen mode, TypeScript
 * will surface an error with a descriptive `{ error: 'Type is not serializable'; expected: ...; received: ... }` object.
 *
 * This provides compile-time safety for constructor arguments passed to `procxy()`.
 * It does not deeply validate nested object properties (TypeScript structural typing
 * makes that infeasible); use `sanitizeV8: true` as a runtime fallback for those cases.
 *
 * @typeParam T - The class whose constructor parameter types are being constrained
 * @typeParam Mode - The serialization mode in use
 * @category Types
 */
export type SerializableConstructorArgs<T, Mode extends SerializationMode> =
  ConstructorParameters<Constructor<T>> extends infer Args extends readonly any[]
    ? { [K in keyof Args]: ValidateProcxiable<Args[K], Mode> }
    : never;

/**
 * Conditional type that resolves to `true` when `T` can cross the IPC boundary in the given mode.
 *
 * @remarks
 * Returns `true` for:
 * - Any type assignable to `Procxiable<Mode>` (JSON-safe or V8-safe depending on mode)
 * - `void` — async methods that return nothing are safe
 * - `undefined` — optional parameters and absent return values
 * - `Function` — reserved for future callback-proxy support (currently validated at runtime)
 *
 * Used internally to filter which methods appear on the {@link Procxy} type.
 *
 * @typeParam T - The type to check
 * @typeParam Mode - The serialization mode
 * @category Types
 */
export type IsProcxiable<T, Mode extends SerializationMode> = T extends
  | Procxiable<Mode>
  | void
  | undefined
  | Function
  ? true
  : false;

/**
 * Check if a type extends Jsonifiable or is a function (callback).
 * Special cases:
 * - void is considered valid (becomes undefined in JSON)
 * - undefined is considered valid (for optional parameters)
 * - Function types are considered valid (will be proxied as callbacks)
 * - For union types like (string | undefined), we use [T] to prevent distribution
 *   and check if the entire union is assignable to (Jsonifiable | void | undefined | Function)
 */
type IsJsonifiable<T> = T extends Jsonifiable | void | undefined | Function ? true : false;

/**
 * Check if all parameters in a tuple are procxiable for the given mode.
 * Generic version that works for both 'json' and 'advanced' modes.
 */
type AreParamsProcxiable<
  P extends readonly any[],
  Mode extends SerializationMode
> = UnionToIntersection<IsProcxiable<ArrayValues<P>, Mode>>;

/**
 * Check if all parameters in a tuple are Jsonifiable.
 * For optional parameters (e.g., greeting?: string), TypeScript represents them
 * as unions with undefined. We map over numeric indices and check if all are jsonifiable.
 */
type AreParamsJsonifiable<P extends readonly any[]> = UnionToIntersection<
  IsJsonifiable<ArrayValues<P>>
>;

/**
 * Get keys of methods that have procxiable parameters and return values for the given mode.
 * Generic version that filters based on serialization mode.
 */
type ProcxiableMethodKeys<T, Mode extends SerializationMode> = {
  [K in keyof T]: T[K] extends (...args: infer A) => infer R
    ? AreParamsProcxiable<A, Mode> extends true
      ? IsProcxiable<Awaited<R>, Mode> extends true
        ? K
        : never
      : never
    : never;
}[keyof T];

/**
 * Pick only methods with procxiable parameters and return values for the given mode.
 */
type ProcxiableMethods<T, Mode extends SerializationMode> = Pick<T, ProcxiableMethodKeys<T, Mode>>;

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
 * Get keys of properties (non-function values) from a type, mode-aware.
 */
type ProcxiablePropertyKeys<T, Mode extends SerializationMode> = {
  [K in keyof T]: T[K] extends (...args: any[]) => any
    ? never
    : IsProcxiable<T[K], Mode> extends true
      ? K
      : never;
}[keyof T];

/**
 * Extract only the serializable, non-method properties from a type — the "data shape" of a class.
 *
 * @remarks
 * `Procxify<T>` picks every property of `T` that:
 * 1. Is not a function (methods are excluded)
 * 2. Is serializable under `Mode` (passes {@link IsProcxiable})
 *
 * This is useful for typing data-transfer objects when you want to accept either a class
 * instance or a plain representation of its data without committing to the full class type.
 * It mirrors the role of type-fest's `Jsonify<T>` but respects the active serialization mode.
 *
 * Properties are not recursively transformed — they retain their original types. This is a
 * shallow pick, not a deep transform.
 *
 * @typeParam T - Source type to extract properties from
 * @typeParam Mode - Serialization mode used to filter eligible properties
 *
 * @example
 * ```typescript
 * import type { Procxify } from 'procxy';
 *
 * class User {
 *   id: number = 0;
 *   name: string = '';
 *   greet() { return `Hello ${this.name}`; }
 * }
 *
 * type UserData = Procxify<User>;
 * // { id: number; name: string }  — greet() excluded because it's a function
 * ```
 *
 * @category Types
 */
export type Procxify<T, Mode extends SerializationMode = 'json'> = {
  [K in keyof T as T[K] extends (...args: any[]) => any
    ? never
    : IsProcxiable<T[K], Mode> extends true
      ? K
      : never]: T[K];
};

/**
 * Get readonly properties from the type (excluding methods), mode-aware.
 * Properties are read-only on the proxy - only the child can modify them.
 */
type ReadonlyProperties<T, Mode extends SerializationMode> = {
  readonly [K in ProcxiablePropertyKeys<T, Mode>]: T[K];
};

/**
 * The proxy type returned by `procxy()` — a transparent async mirror of a remote class instance.
 *
 * @remarks
 * `Procxy<T>` transforms `T` for cross-process use:
 *
 * **Methods**: Every method of `T` whose parameters and return value are serializable under
 * `Mode` is included, with its return type wrapped in `Promise`. Methods with non-serializable
 * signatures are silently omitted from the proxy type (TypeScript will report a type error if
 * you try to call them). Async methods are flattened — `Promise<Promise<X>>` becomes
 * `Promise<X>` via `Awaited<R>`.
 *
 * **Properties**: Non-method properties that are serializable are included as `readonly`.
 * They reflect the value the child had at last read; they are not live references.
 * Setting a property on the proxy has no effect on the child — use a method for that.
 *
 * **Lifecycle (`$` prefix)**: Four lifecycle members are always present regardless of `T`:
 * - `$terminate()` — sends `SIGTERM` to the child and waits for it to exit
 * - `$process` — the raw `ChildProcess` handle; inspect `pid`, `exitCode`, `kill()` etc.
 * - `[Symbol.dispose]()` — synchronous dispose for `using` (initiates but does not await termination)
 * - `[Symbol.asyncDispose]()` — async dispose for `await using` (awaits full shutdown)
 *
 * **EventEmitter**: When `T extends EventEmitter<E>`, the proxy gains typed `on`, `once`,
 * `off`, and `removeListener` methods. Events are forwarded over IPC from child to parent.
 * Only events whose listener parameters are JSON-serializable are forwarded; events with
 * `Function` parameters are filtered out at the type level.  `.emit()` is **not** available
 * on the proxy — events originate in the child only.
 *
 * **Handle passing** (`SupportHandles extends true`): When enabled, a `$sendHandle(handle, id?)`
 * method is added. The handle (Socket, Server, dgram.Socket, or fd) is transferred to the child
 * and must not be used in the parent after the call. Full support on Unix; limited on Windows.
 *
 * @typeParam T - The original class type whose instance runs in the child process
 * @typeParam Mode - Serialization mode: `'json'` (default) or `'advanced'`
 * @typeParam SupportHandles - Literal `true` to add `$sendHandle`; `false` (default) to omit it
 *
 * @useWhen
 * - You need the return type of `procxy()` for a function parameter or variable annotation
 * - You are building higher-order abstractions over proxied classes and need type-level introspection
 * - You want to constrain a generic to only accept Procxy instances (`T extends Procxy<any>`)
 *
 * @avoidWhen
 * - You expect property reads to reflect live child state — they don't; properties are snapshotted at the time of each read call
 *
 * @never
 * - NEVER check `proxy instanceof MyClass` — the proxy is a plain object; instanceof will always be false
 * - NEVER destructure methods off the proxy (`const { add } = proxy`) — the IPC context is lost and calls will throw
 * - NEVER call `$terminate()` and then await another method — the child is gone; the call throws `ChildCrashedError`
 *
 * @example
 * ```typescript
 * import { procxy, type Procxy } from 'procxy';
 * import { Calculator } from './calculator.js';
 *
 * // Explicit type annotation
 * let calc: Procxy<Calculator>;
 * calc = await procxy(Calculator);
 * const result = await calc.add(1, 2); // Promise<number>
 * await calc.$terminate();
 * ```
 *
 * @example
 * ```typescript
 * // await using for automatic cleanup
 * import { procxy } from 'procxy';
 * import { Calculator } from './calculator.js';
 *
 * await using calc = await procxy(Calculator);
 * const sum = await calc.add(3, 4); // 7
 * // calc.$terminate() is called automatically here
 * ```
 *
 * @example
 * ```typescript
 * // Advanced mode with Buffer support
 * import { procxy } from 'procxy';
 * import { ImageResizer } from './image-resizer.js';
 *
 * await using resizer = await procxy(
 *   ImageResizer,
 *   './image-resizer.js',
 *   { serialization: 'advanced' } as const
 * );
 * const thumbnail: Buffer = await resizer.resize(sourceBuffer, 200, 200);
 * ```
 *
 * @category Core
 * @see {@link procxy} — factory function that creates this proxy
 * @see {@link ProcxyOptions} — configuration controlling mode and lifecycle
 * @see {@link PassableHandle} — types accepted by `$sendHandle`
 */
export type Procxy<
  T,
  Mode extends SerializationMode = 'json',
  SupportHandles extends boolean = false
> = {
  /**
   * Transform all procxiable methods to async.
   * Methods with non-procxiable parameters or return values are excluded.
   */
  [K in keyof ProcxiableMethods<T, Mode>]: ProcxiableMethods<T, Mode>[K] extends (
    ...args: infer A
  ) => infer R
    ? (...args: A) => Promise<Awaited<R>>
    : never;
} & ReadonlyProperties<T, Mode> & {
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
  } & (SupportHandles extends true
    ? {
        /**
         * Send a handle (socket, server, or file descriptor) to the child process.
         * The handle is transferred to the child and should not be used in the parent after this call.
         *
         * **Available only when `supportHandles: true` in ProcxyOptions**
         *
         * @param handle - The handle to send (Socket, Server, dgram.Socket, or file descriptor)
         * @param handleId - Optional identifier for the handle in the child process
         * @returns Promise that resolves when the handle has been sent
         *
         * @throws {Error} If the handle type is not supported
         * @throws {Error} If called on Windows (limited support)
         *
         * @remarks
         * - The handle is transferred, not cloned
         * - Parent should not use the handle after sending
         * - Child receives handle via internal registry
         * - Platform-specific: full support on Unix, limited on Windows
         *
         * @example
         * ```typescript
         * import { procxy } from 'procxy';
         * import net from 'net';
         *
         * const worker = await procxy(SocketHandler, {
         *   serialization: 'advanced',
         *   supportHandles: true
         * } as const);
         *
         * const socket = new net.Socket();
         * socket.connect(8080, 'localhost');
         *
         * // Transfer socket to child (ownership transferred)
         * await worker.$sendHandle(socket);
         * ```
         */
        $sendHandle(handle: PassableHandle, handleId?: string): Promise<void>;
      }
    : {}) &
  (T extends EventEmitter<infer E>
    ? E extends Record<string | symbol, any[]>
      ? // EventEmitter with typed event map - always provide methods
        {
          on<K extends keyof JsonifiableEventMap<ExtractEventMap<T>>>(
            event: K,
            listener: JsonifiableEventMap<ExtractEventMap<T>>[K]
          ): Procxy<T, Mode, SupportHandles>;
          on(
            event: string | symbol,
            listener: (...args: any[]) => void
          ): Procxy<T, Mode, SupportHandles>;
          once<K extends keyof JsonifiableEventMap<ExtractEventMap<T>>>(
            event: K,
            listener: JsonifiableEventMap<ExtractEventMap<T>>[K]
          ): Procxy<T, Mode, SupportHandles>;
          once(
            event: string | symbol,
            listener: (...args: any[]) => void
          ): Procxy<T, Mode, SupportHandles>;
          off<K extends keyof JsonifiableEventMap<ExtractEventMap<T>>>(
            event: K,
            listener: JsonifiableEventMap<ExtractEventMap<T>>[K]
          ): Procxy<T, Mode, SupportHandles>;
          off(
            event: string | symbol,
            listener: (...args: any[]) => void
          ): Procxy<T, Mode, SupportHandles>;
          removeListener<K extends keyof JsonifiableEventMap<ExtractEventMap<T>>>(
            event: K,
            listener: JsonifiableEventMap<ExtractEventMap<T>>[K]
          ): Procxy<T, Mode, SupportHandles>;
          removeListener(
            event: string | symbol,
            listener: (...args: any[]) => void
          ): Procxy<T, Mode, SupportHandles>;
        }
      : {
          // EventEmitter without typed event map - provide untyped methods
          on(
            event: string | symbol,
            listener: (...args: any[]) => void
          ): Procxy<T, Mode, SupportHandles>;
          once(
            event: string | symbol,
            listener: (...args: any[]) => void
          ): Procxy<T, Mode, SupportHandles>;
          off(
            event: string | symbol,
            listener: (...args: any[]) => void
          ): Procxy<T, Mode, SupportHandles>;
          removeListener(
            event: string | symbol,
            listener: (...args: any[]) => void
          ): Procxy<T, Mode, SupportHandles>;
        }
    : T extends EventEmitter
      ? {
          // Plain EventEmitter (no generic parameter)
          on(
            event: string | symbol,
            listener: (...args: any[]) => void
          ): Procxy<T, Mode, SupportHandles>;
          once(
            event: string | symbol,
            listener: (...args: any[]) => void
          ): Procxy<T, Mode, SupportHandles>;
          off(
            event: string | symbol,
            listener: (...args: any[]) => void
          ): Procxy<T, Mode, SupportHandles>;
          removeListener(
            event: string | symbol,
            listener: (...args: any[]) => void
          ): Procxy<T, Mode, SupportHandles>;
        }
      : {});

/**
 * Union of OS-level handle types that can be transferred to the child process via `$sendHandle`.
 *
 * @remarks
 * Handles are **transferred**, not cloned. Once sent, the parent process loses ownership:
 * using the handle in the parent after calling `$sendHandle()` results in undefined behavior.
 *
 * Supported types:
 * - `net.Socket` — TCP or IPC stream socket
 * - `net.Server` — TCP or IPC server (passes the listening descriptor)
 * - `dgram.Socket` — UDP datagram socket
 * - `number` — raw POSIX file descriptor (Unix only)
 *
 * Platform notes:
 * - Full support on Linux and macOS via `SCM_RIGHTS` (Unix domain socket ancillary data)
 * - Limited support on Windows; `net.Socket` transfer works but `dgram.Socket` and raw fd do not
 *
 * Handle passing requires `supportHandles: true` in {@link ProcxyOptions} **and**
 * `serialization: 'advanced'`. A warning is logged when `supportHandles: true` is set on Windows.
 *
 * @category Types
 * @see {@link Procxy} — proxy type whose `$sendHandle` method accepts this type
 */
export type PassableHandle =
  | import('net').Socket
  | import('net').Server
  | import('dgram').Socket
  | number;
