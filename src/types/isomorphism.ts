import type { Procxy } from './procxy.js';
import type { SerializationMode } from './options.js';

/**
 * Type utilities for working with the isomorphism between T and Procxy<T>.
 * These utilities enable bidirectional type mapping and introspection.
 */

/**
 * Extract the original type `T` from `Procxy<T, Mode, SupportHandles>`.
 *
 * @remarks
 * Inverse of the `Procxy<T>` transformation. When you have a `Procxy<T>` and need to
 * recover `T` for type-level operations, use this utility. Returns `never` for non-Procxy types.
 *
 * @typeParam P - A `Procxy` type to unwrap
 *
 * @example
 * ```typescript
 * import type { Procxy, UnwrapProcxy } from 'procxy';
 * import { Calculator } from './calculator.js';
 *
 * type CalcProxy = Procxy<Calculator>;
 * type Original = UnwrapProcxy<CalcProxy>; // Calculator
 * ```
 *
 * @category Type Utilities
 */
export type UnwrapProcxy<P> = P extends Procxy<infer T, any, any> ? T : never;

/**
 * Conditional type that resolves to `true` when `P` is a `Procxy` type.
 *
 * @typeParam P - Type to check
 *
 * @example
 * ```typescript
 * import type { IsProcxy, Procxy } from 'procxy';
 * import { Calculator } from './calculator.js';
 *
 * type Check1 = IsProcxy<Procxy<Calculator>>; // true
 * type Check2 = IsProcxy<Calculator>;         // false
 * ```
 *
 * @category Type Utilities
 */
export type IsProcxy<P> = P extends Procxy<any, any, any> ? true : false;

/**
 * Extract the serialization mode from a `Procxy` type.
 *
 * @typeParam P - A `Procxy` type
 *
 * @example
 * ```typescript
 * import type { GetProcxyMode, Procxy } from 'procxy';
 *
 * type Mode1 = GetProcxyMode<Procxy<Calculator, 'json'>>;     // 'json'
 * type Mode2 = GetProcxyMode<Procxy<Worker, 'advanced'>>;     // 'advanced'
 * ```
 *
 * @category Type Utilities
 */
export type GetProcxyMode<P> = P extends Procxy<any, infer Mode, any> ? Mode : never;

/**
 * Conditional type that resolves to `true` when `P` has `$sendHandle` support.
 *
 * @typeParam P - A `Procxy` type
 *
 * @example
 * ```typescript
 * import type { HasHandleSupport, Procxy } from 'procxy';
 *
 * type Has1 = HasHandleSupport<Procxy<Worker, 'advanced', true>>;  // true
 * type Has2 = HasHandleSupport<Procxy<Worker, 'json', false>>;     // false
 * ```
 *
 * @category Type Utilities
 */
export type HasHandleSupport<P> =
  P extends Procxy<any, any, infer SH> ? (SH extends true ? true : false) : false;

/**
 * Produce a new `Procxy` type identical to `P` except with a different serialization mode.
 *
 * @typeParam P - Source `Procxy` type
 * @typeParam NewMode - The target serialization mode
 *
 * @example
 * ```typescript
 * import type { ChangeProcxyMode, Procxy } from 'procxy';
 *
 * type JsonProxy = Procxy<Calculator, 'json'>;
 * type AdvancedProxy = ChangeProcxyMode<JsonProxy, 'advanced'>;
 * // Procxy<Calculator, 'advanced', false>
 * ```
 *
 * @category Type Utilities
 */
export type ChangeProcxyMode<P, NewMode extends SerializationMode> =
  P extends Procxy<infer T, any, infer SH> ? Procxy<T, NewMode, SH> : never;

/**
 * Produce a new `Procxy` type identical to `P` except with a different `SupportHandles` flag.
 *
 * @typeParam P - Source `Procxy` type
 * @typeParam NewSH - The new handle-support literal boolean
 *
 * @example
 * ```typescript
 * import type { ToggleProcxyHandles, Procxy } from 'procxy';
 *
 * type NoHandles = Procxy<Worker, 'advanced', false>;
 * type WithHandles = ToggleProcxyHandles<NoHandles, true>;
 * // Procxy<Worker, 'advanced', true>
 * ```
 *
 * @category Type Utilities
 */
export type ToggleProcxyHandles<P, NewSH extends boolean> =
  P extends Procxy<infer T, infer Mode, any> ? Procxy<T, Mode, NewSH> : never;

/**
 * Describes the bidirectional type mapping between `T` and `Procxy<T>`.
 *
 * @remarks
 * Surfaces both directions as named properties for documentation and type-level reasoning.
 * Primarily useful as a teaching tool or for libraries that need to assert the isomorphism holds.
 *
 * @typeParam T - Original class type
 * @typeParam Mode - Serialization mode
 * @typeParam SH - Handle support flag
 *
 * @example
 * ```typescript
 * import type { ProcxyIsomorphism } from 'procxy';
 * import { Calculator } from './calculator.js';
 *
 * type Iso = ProcxyIsomorphism<Calculator>;
 * type Forward = Iso['forward'];   // Procxy<Calculator>
 * type Backward = Iso['backward']; // Calculator
 * ```
 *
 * @category Type Utilities
 */
export type ProcxyIsomorphism<
  T,
  Mode extends SerializationMode = 'json',
  SH extends boolean = false
> = {
  /** Forward mapping: T → Procxy<T> */
  forward: Procxy<T, Mode, SH>;
  /** Backward mapping: Procxy<T> → T (via UnwrapProcxy) */
  backward: T;
};

/**
 * Compile-time assertion that `T` round-trips through `Procxy<T>` without loss.
 *
 * @remarks
 * Resolves to `T` when `UnwrapProcxy<Procxy<T, Mode, SH>>` extends `T` (i.e., the
 * isomorphism holds). Resolves to `never` otherwise — useful in a `type _check = VerifyIsomorphism<T>`
 * statement to get a compile error when the mapping breaks.
 *
 * @typeParam T - Original type to verify
 * @typeParam Mode - Serialization mode
 * @typeParam SH - Handle support flag
 *
 * @example
 * ```typescript
 * import type { VerifyIsomorphism } from 'procxy';
 * import { Calculator } from './calculator.js';
 *
 * type _check = VerifyIsomorphism<Calculator>; // Calculator (isomorphism holds)
 * ```
 *
 * @category Type Utilities
 */
export type VerifyIsomorphism<
  T,
  Mode extends SerializationMode = 'json',
  SH extends boolean = false
> = UnwrapProcxy<Procxy<T, Mode, SH>> extends T ? T : never;

/**
 * Conditional type that resolves to `true` when `T <-> Procxy<T>` form a consistent isomorphism.
 *
 * @remarks
 * Checks both directions: `T -> Procxy<T>` (forward) and `Procxy<T> -> T` (backward via
 * `UnwrapProcxy`). Returns `false` if either direction breaks, e.g., when `T` has methods
 * with non-serializable signatures that disappear from the proxy type.
 *
 * @typeParam T - Original type
 * @typeParam Mode - Serialization mode
 * @typeParam SH - Handle support flag
 *
 * @category Type Utilities
 */
export type IsProcxyIsomorphic<
  T,
  Mode extends SerializationMode = 'json',
  SH extends boolean = false
> =
  UnwrapProcxy<Procxy<T, Mode, SH>> extends T
    ? Procxy<T, Mode, SH> extends Procxy<UnwrapProcxy<Procxy<T, Mode, SH>>, Mode, SH>
      ? true
      : false
    : false;

/**
 * Extract the union of user-defined method names available on a `Procxy` type.
 *
 * @remarks
 * Excludes all `$`-prefixed lifecycle members and symbol keys. Returns `never` for non-Procxy types.
 * Useful for generic utilities that need to enumerate callable methods on any proxy.
 *
 * @typeParam P - A `Procxy` type
 *
 * @example
 * ```typescript
 * import type { GetProcxyMethods, Procxy } from 'procxy';
 *
 * class Calculator {
 *   add(a: number, b: number): number { return a + b; }
 * }
 *
 * type Methods = GetProcxyMethods<Procxy<Calculator>>; // 'add'
 * ```
 *
 * @category Type Utilities
 */
export type GetProcxyMethods<P> =
  P extends Procxy<any, any, any> ? Exclude<keyof P, symbol | `$${string}`> : never;

/**
 * Extract the lifecycle method and property names from a `Procxy` type.
 *
 * @remarks
 * Returns the union of all `$`-prefixed keys (`$terminate`, `$process`, `$sendHandle`)
 * plus symbol keys (`Symbol.dispose`, `Symbol.asyncDispose`). Returns `never` for non-Procxy types.
 *
 * @typeParam P - A `Procxy` type
 *
 * @example
 * ```typescript
 * import type { GetProcxyLifecycleMethods, Procxy } from 'procxy';
 *
 * type LC = GetProcxyLifecycleMethods<Procxy<Calculator>>;
 * // '$terminate' | '$process' | typeof Symbol.dispose | typeof Symbol.asyncDispose
 * ```
 *
 * @category Type Utilities
 */
export type GetProcxyLifecycleMethods<P> =
  P extends Procxy<any, any, any> ? Extract<keyof P, `$${string}` | symbol> : never;

/**
 * A value that is either the original type `T` or a `Procxy<T>` proxy for it.
 *
 * @remarks
 * Useful for writing functions that accept both local instances and remote proxies
 * of the same class — combine with {@link isProcxy} to branch at runtime.
 *
 * @typeParam T - The original (non-proxy) class type
 * @category Types
 */
export type MaybeProxy<T> = T | Procxy<T, any, any>;

/**
 * Runtime type guard that returns `true` when `obj` is a live Procxy proxy.
 *
 * @remarks
 * Detection is duck-typed: the function checks for the presence of `$terminate` (function)
 * and `$process` (object) on the value. This is reliable for procxy-created proxies but
 * could yield a false positive for hand-crafted objects that happen to have those properties.
 *
 * @param obj - A value that is either the original type `T` or a `Procxy<T>`
 * @returns `true` when `obj` has the Procxy lifecycle interface
 *
 * @example
 * ```typescript
 * import { procxy, isProcxy } from 'procxy';
 * import { Calculator } from './calculator.js';
 *
 * function processWorker(worker: Calculator | Procxy<Calculator>) {
 *   if (isProcxy(worker)) {
 *     console.log('Remote proxy, PID:', worker.$process.pid);
 *   } else {
 *     console.log('Local instance');
 *   }
 * }
 * ```
 *
 * @category Runtime Utilities
 * @see {@link isAdvancedMode} — check whether a proxy uses advanced serialization
 */
export function isProcxy<T>(obj: MaybeProxy<T>): obj is Procxy<T, any, any> {
  if (!obj || typeof obj !== 'object') {
    return false;
  }

  const maybe = obj as Record<string | symbol, unknown>;
  return (
    '$terminate' in maybe &&
    typeof maybe['$terminate'] === 'function' &&
    '$process' in maybe &&
    typeof maybe['$process'] === 'object'
  );
}

/**
 * Narrow a proxy's type to `Procxy<T, 'advanced', H>` at runtime.
 *
 * @remarks
 * Calls the internal `$getSerializationMode()` method that every proxy exposes.
 * If the proxy was created with `serialization: 'advanced'`, this returns `true` and
 * the TypeScript type is narrowed accordingly — useful when you receive a `Procxy<T, any, H>`
 * and need to call a method that only accepts advanced-mode proxies.
 *
 * @param proxy - Any `Procxy` instance
 * @returns `true` when the proxy was spawned with `serialization: 'advanced'`
 *
 * @example
 * ```typescript
 * import { procxy, isAdvancedMode } from 'procxy';
 * import { Worker } from './worker.js';
 *
 * const w = await procxy(Worker, { serialization: 'advanced' } as const);
 * if (isAdvancedMode(w)) {
 *   // TypeScript now knows w is Procxy<Worker, 'advanced', false>
 *   console.log('Can send Buffers');
 * }
 * ```
 *
 * @category Runtime Utilities
 * @see {@link isProcxy} — check whether any value is a proxy at all
 * @see {@link isHandleSupported} — check whether the proxy can send OS handles
 */
export function isAdvancedMode<T, H extends boolean>(
  proxy: Procxy<T, any, H>
): proxy is Procxy<T, 'advanced', H> {
  const getMode = (proxy as any)?.$getSerializationMode;
  if (typeof getMode !== 'function') {
    return false;
  }
  return getMode.call(proxy) === 'advanced';
}

/**
 * Narrow a proxy's type to `Procxy<T, 'advanced', true>` when handle passing is enabled.
 *
 * @remarks
 * Calls the internal `$isHandleSupported()` method. Returns `true` only when the proxy
 * was created with both `serialization: 'advanced'` and `supportHandles: true`. After
 * narrowing, the `$sendHandle` method is available on the proxy type.
 *
 * @param proxy - Any `Procxy` instance
 * @returns `true` when `$sendHandle` is available on this proxy
 *
 * @example
 * ```typescript
 * import { procxy, isHandleSupported } from 'procxy';
 * import net from 'net';
 * import { SocketHandler } from './socket-handler.js';
 *
 * const handler = await procxy(SocketHandler, {
 *   serialization: 'advanced',
 *   supportHandles: true
 * } as const);
 *
 * if (isHandleSupported(handler)) {
 *   // TypeScript knows $sendHandle is available
 *   const socket = new net.Socket();
 *   socket.connect(8080, 'localhost');
 *   await handler.$sendHandle(socket);
 * }
 * ```
 *
 * @category Runtime Utilities
 * @see {@link isAdvancedMode} — check serialization mode without handle support
 * @see {@link PassableHandle} — types accepted by `$sendHandle`
 */
export function isHandleSupported<T, H extends boolean>(
  proxy: Procxy<T, any, H>
): proxy is Procxy<T, 'advanced', true> {
  const isSupported = (proxy as any)?.$isHandleSupported;
  if (typeof isSupported !== 'function') {
    return false;
  }
  return isSupported.call(proxy) === true;
}
