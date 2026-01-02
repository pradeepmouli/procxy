import type { Procxy } from './procxy.js';
import type { SerializationMode } from './options.js';

/**
 * Type utilities for working with the isomorphism between T and Procxy<T>.
 * These utilities enable bidirectional type mapping and introspection.
 */

/**
 * Extract the original type T from Procxy<T, Mode, SupportHandles>.
 * This is the inverse operation of applying Procxy<T>.
 *
 * @template P - A Procxy type
 * @returns The underlying original type T
 *
 * @example
 * ```typescript
 * class Calculator {
 *   add(a: number, b: number): number { return a + b; }
 * }
 *
 * type CalcProxy = Procxy<Calculator>;
 * type Original = UnwrapProcxy<CalcProxy>; // Calculator
 * ```
 */
export type UnwrapProcxy<P> = P extends Procxy<infer T, any, any> ? T : never;

/**
 * Check if a type is a Procxy type.
 *
 * @template P - Type to check
 * @returns true if P is a Procxy type, false otherwise
 *
 * @example
 * ```typescript
 * type Check1 = IsProcxy<Procxy<Calculator>>; // true
 * type Check2 = IsProcxy<Calculator>; // false
 * ```
 */
export type IsProcxy<P> = P extends Procxy<any, any, any> ? true : false;

/**
 * Get the serialization mode from a Procxy type.
 *
 * @template P - A Procxy type
 * @returns The serialization mode ('json' | 'advanced')
 *
 * @example
 * ```typescript
 * type Mode1 = GetProcxyMode<Procxy<Calculator, 'json'>>; // 'json'
 * type Mode2 = GetProcxyMode<Procxy<Worker, 'advanced'>>; // 'advanced'
 * ```
 */
export type GetProcxyMode<P> = P extends Procxy<any, infer Mode, any> ? Mode : never;

/**
 * Check if a Procxy type has handle support enabled.
 *
 * @template P - A Procxy type
 * @returns true if handle passing is enabled, false otherwise
 *
 * @example
 * ```typescript
 * type Has1 = HasHandleSupport<Procxy<Worker, 'advanced', true>>; // true
 * type Has2 = HasHandleSupport<Procxy<Worker, 'json', false>>; // false
 * ```
 */
export type HasHandleSupport<P> =
  P extends Procxy<any, any, infer SH> ? (SH extends true ? true : false) : false;

/**
 * Recreate a Procxy type with a different serialization mode.
 * Useful for converting between 'json' and 'advanced' modes while preserving the underlying type.
 *
 * @template P - A Procxy type
 * @template NewMode - The new serialization mode
 * @returns A new Procxy type with the same T but different Mode
 *
 * @example
 * ```typescript
 * type JsonProxy = Procxy<Calculator, 'json'>;
 * type AdvancedProxy = ChangeProcxyMode<JsonProxy, 'advanced'>; // Procxy<Calculator, 'advanced'>
 * ```
 */
export type ChangeProcxyMode<P, NewMode extends SerializationMode> =
  P extends Procxy<infer T, any, infer SH> ? Procxy<T, NewMode, SH> : never;

/**
 * Enable or disable handle support on a Procxy type.
 *
 * @template P - A Procxy type
 * @template NewSH - The new handle support flag
 * @returns A new Procxy type with the same T and Mode but different SupportHandles
 *
 * @example
 * ```typescript
 * type NoHandles = Procxy<Worker, 'advanced', false>;
 * type WithHandles = ToggleProcxyHandles<NoHandles, true>; // Procxy<Worker, 'advanced', true>
 * ```
 */
export type ToggleProcxyHandles<P, NewSH extends boolean> =
  P extends Procxy<infer T, infer Mode, any> ? Procxy<T, Mode, NewSH> : never;

/**
 * Bidirectional mapping between T and Procxy<T>.
 * Demonstrates the isomorphism property.
 *
 * @template T - Original type
 * @template Mode - Serialization mode
 * @template SH - Handle support flag
 *
 * @example
 * ```typescript
 * // Forward: T → Procxy<T>
 * type Forward = ProcxyIsomorphism<Calculator>['forward']; // Procxy<Calculator>
 *
 * // Backward: Procxy<T> → T
 * type Backward = ProcxyIsomorphism<Calculator>['backward']; // Calculator
 * ```
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
 * Verify that the forward and backward mappings form an isomorphism.
 * This type will resolve to T if the isomorphism holds, otherwise never.
 *
 * @template T - Original type
 * @template Mode - Serialization mode
 * @template SH - Handle support flag
 * @returns T if UnwrapProcxy<Procxy<T>> === T, otherwise never
 *
 * @example
 * ```typescript
 * // Should equal Calculator
 * type Valid = VerifyIsomorphism<Calculator>; // Calculator
 * ```
 */
export type VerifyIsomorphism<
  T,
  Mode extends SerializationMode = 'json',
  SH extends boolean = false
> = UnwrapProcxy<Procxy<T, Mode, SH>> extends T ? T : never;

/**
 * Compile-time check that T <-> Procxy<T> form an isomorphism.
 * Returns true when forward (T -> Procxy<T>) and backward (Procxy<T> -> T) mappings are consistent.
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
 * Extract method names that are procxiable (available on the proxy).
 * These are the methods that will be present on Procxy<T>.
 *
 * @template P - A Procxy type
 * @returns Union of method names available on the proxy
 *
 * @example
 * ```typescript
 * class Calculator {
 *   add(a: number, b: number): number { return a + b; }
 *   private secret(): void {}
 * }
 *
 * type Methods = GetProcxyMethods<Procxy<Calculator>>; // 'add'
 * ```
 */
export type GetProcxyMethods<P> =
  P extends Procxy<any, any, any> ? Exclude<keyof P, symbol | `$${string}`> : never;

/**
 * Extract lifecycle methods from Procxy type.
 * These are the special methods prefixed with $ or symbols.
 *
 * @template P - A Procxy type
 * @returns Union of lifecycle method names
 *
 * @example
 * ```typescript
 * type Lifecycle = GetProcxyLifecycleMethods<Procxy<Calculator>>; // '$terminate' | '$process' | '$sendHandle' | Symbol.dispose | Symbol.asyncDispose
 * ```
 */
export type GetProcxyLifecycleMethods<P> =
  P extends Procxy<any, any, any> ? Extract<keyof P, `$${string}` | symbol> : never;

export type MaybeProxy<T> = T | Procxy<T, any, any>;

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

export function isAdvancedMode<T, H extends boolean>(
  proxy: Procxy<T, any, H>
): proxy is Procxy<T, 'advanced', H> {
  const getMode = (proxy as any)?.$getSerializationMode;
  if (typeof getMode !== 'function') {
    return false;
  }
  return getMode.call(proxy) === 'advanced';
}

export function isHandleSupported<T, H extends boolean>(
  proxy: Procxy<T, any, H>
): proxy is Procxy<T, 'advanced', true> {
  const isSupported = (proxy as any)?.$isHandleSupported;
  if (typeof isSupported !== 'function') {
    return false;
  }
  return isSupported.call(proxy) === true;
}
