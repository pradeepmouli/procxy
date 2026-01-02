/**
 * Procxy - A TypeScript library for transparent process-based proxy of class instances.
 *
 * @packageDocumentation
 *
 * ## Overview
 *
 * Procxy enables you to run class instances in isolated child processes while interacting
 * with them as if they were local objects. All method calls become async and are transparently
 * forwarded over IPC.
 *
 * ## Key Features
 *
 * - 🎯 **Type-Safe**: Full TypeScript support with IntelliSense
 * - ⚡ **Fast**: <10ms overhead per method call
 * - 🔄 **Event Support**: Transparent EventEmitter forwarding
 * - 🛡️ **Error Handling**: Complete error propagation with stack traces
 * - 🧹 **Lifecycle**: Automatic cleanup with disposable protocol support
 * - ⚙️ **Configurable**: Timeouts, retries, custom env/cwd
 *
 * ## Quick Start
 *
 * ```typescript
 * import { procxy } from 'procxy';
 *
 * class Calculator {
 *   add(a: number, b: number) { return a + b; }
 * }
 *
 * // Create remote instance
 * const calc = await procxy(Calculator, './calculator.js');
 *
 * // Call methods (now async)
 * const result = await calc.add(5, 3); // 8
 *
 * // Clean up
 * await calc.$terminate();
 * ```
 *
 * ## Using Disposables (Recommended)
 *
 * ```typescript
 * // Automatic cleanup with await using
 * await using calc = await procxy(Calculator, './calculator.js');
 * const result = await calc.add(5, 3);
 * // Automatically terminated when scope exits
 * ```
 *
 * @module procxy
 */

/**
 * Main function to create a process-based proxy for a class instance.
 *
 * @see {@link procxy} for detailed documentation and examples
 */
export { procxy } from './parent/procxy.js';

/**
 * Type representing the proxy object for a remote class instance.
 *
 * All methods are transformed to async (returning Promise<ReturnType>).
 * Adds lifecycle methods: $terminate() and $process property.
 *
 * @typeParam T - The original class type
 *
 * @see {@link Procxy} type definition
 */
export type { Procxy } from './types/procxy.js';

/**
 * Configuration options for the procxy() function.
 *
 * Controls child process creation, timeouts, retries, and environment.
 *
 * @see {@link ProcxyOptions} interface
 */
export type { ProcxyOptions, SerializationMode } from './types/options.js';

/**
 * Type definitions for V8 serializable types and mode-aware type checking.
 *
 * @see {@link V8Serializable} - Types supported by V8 structured clone algorithm
 * @see {@link Procxiable} - Get serializable type constraint for a given mode
 * @see {@link IsProcxiable} - Check if a type is serializable for a given mode
 * @see {@link SerializableConstructorArgs} - Constrain constructor args to be serializable
 * @see {@link PassableHandle} - Types that can be transferred as handles
 */
export type { V8Serializable } from './shared/serialization.js';
export { sanitizeForV8, sanitizeForV8Array } from './shared/serialization.js';
export type {
  Procxiable,
  IsProcxiable,
  SerializableConstructorArgs,
  PassableHandle
} from './types/procxy.js';

/**
 * Base error class for all Procxy-specific errors.
 *
 * All errors thrown by Procxy inherit from this class, making it easy
 * to catch and handle library-specific errors.
 *
 * @example
 * ```typescript
 * try {
 *   const result = await proxy.method();
 * } catch (err) {
 *   if (err instanceof ProcxyError) {
 *     console.log('Procxy error:', err.message);
 *   }
 * }
 * ```
 */
export { ProcxyError } from './shared/errors.js';

/**
 * Error thrown when a method call exceeds the configured timeout.
 *
 * @example
 * ```typescript
 * import { TimeoutError } from 'procxy';
 *
 * try {
 *   await proxy.slowMethod();
 * } catch (err) {
 *   if (err instanceof TimeoutError) {
 *     console.log(`Timeout after ${err.timeoutMs}ms`);
 *   }
 * }
 * ```
 */
export { TimeoutError } from './shared/errors.js';

/**
 * Error thrown when module path resolution fails.
 *
 * This typically occurs when the module path cannot be determined automatically
 * or when the provided modulePath doesn't exist.
 */
export { ModuleResolutionError } from './shared/errors.js';

/**
 * Error thrown when the child process exits unexpectedly.
 *
 * Contains information about the exit code and signal that caused termination.
 */
export { ChildCrashedError } from './shared/errors.js';

/**
 * Error thrown when serialization of arguments or return values fails.
 *
 * All method arguments and return values must be JSON-serializable.
 */
export { SerializationError } from './shared/errors.js';

/**
 * Error thrown when ProcxyOptions contain invalid values.
 *
 * Validates timeout, retries, env, cwd, and args options.
 */
export { OptionsValidationError } from './shared/errors.js';

/**
 * Protocol message types for advanced use cases.
 *
 * These types represent the internal IPC messages exchanged between
 * parent and child processes. Most users won't need these.
 *
 * @remarks
 * These are low-level types used internally by procxy.
 */
export type {
  InitMessage,
  Request,
  Response,
  ErrorInfo,
  EventMessage,
  ParentToChildMessage,
  ChildToParentMessage,
  HandleMessage,
  HandleAck
} from './shared/protocol.js';

/**
 * Type utilities for working with the isomorphism between T and Procxy<T>.
 *
 * These utilities enable bidirectional type mapping and introspection:
 * - UnwrapProcxy: Extract T from Procxy<T>
 * - IsProcxy: Check if a type is a Procxy type
 * - IsProcxyIsomorphic: Compile-time verification that T <-> Procxy<T> form an isomorphism
 * - ProcxyIsomorphism: Demonstrate the bidirectional mapping
 * - ChangeProcxyMode: Convert between serialization modes
 * - VerifyIsomorphism: Compile-time verification of the isomorphism
 * - MaybeProxy: Type representing either T or Procxy<T>
 * - Procxify: Extract procxiable properties from an object type
 *
 * @example
 * ```typescript
 * import { Procxy, UnwrapProcxy, ProcxyIsomorphism } from 'procxy';
 *
 * class Calculator {
 *   add(a: number, b: number): number { return a + b; }
 * }
 *
 * // Forward: T → Procxy<T>
 * type ProxiedCalc = Procxy<Calculator>;
 *
 * // Backward: Procxy<T> → T
 * type OriginalCalc = UnwrapProcxy<ProxiedCalc>; // Calculator
 *
 * // Isomorphism verification
 * type Iso = ProcxyIsomorphism<Calculator>;
 * type Forward = Iso['forward']; // Procxy<Calculator>
 * type Backward = Iso['backward']; // Calculator
 * ```
 */
export type {
  UnwrapProcxy,
  IsProcxy,
  IsProcxyIsomorphic,
  GetProcxyMode,
  HasHandleSupport,
  ChangeProcxyMode,
  ToggleProcxyHandles,
  ProcxyIsomorphism,
  VerifyIsomorphism,
  GetProcxyMethods,
  GetProcxyLifecycleMethods,
  MaybeProxy
} from './types/isomorphism.js';

/**
 * Runtime utilities for working with Procxy instances.
 *
 * These functions provide runtime checks for Procxy instances:
 * - isProcxy: Check if a value is a Procxy instance
 * - isAdvancedMode: Check if a Procxy instance uses advanced serialization mode
 * - isHandleSupported: Check if a Procxy instance supports handle passing
 *
 * @example
 * ```typescript
 * import { procxy, isProcxy, isAdvancedMode } from 'procxy';
 *
 * const calc = await procxy(Calculator, './calculator.js');
 *
 * if (isProcxy(calc)) {
 *   console.log('Is a Procxy instance');
 * }
 *
 * if (isAdvancedMode(calc)) {
 *   console.log('Using advanced serialization');
 * }
 * ```
 */
export { isProcxy, isAdvancedMode, isHandleSupported } from './types/isomorphism.js';

/**
 * Type utility for extracting procxiable properties from an object.
 *
 * Procxify picks only non-method properties that can be serialized across the IPC boundary
 * based on the serialization mode. This is useful for typing data transfer objects.
 *
 * @example
 * ```typescript
 * import { Procxify } from 'procxy';
 *
 * class User {
 *   name: string;
 *   age: number;
 *   greet() { return `Hello ${this.name}`; }
 * }
 *
 * type UserData = Procxify<User>; // { name: string; age: number }
 * ```
 */
export type { Procxify } from './types/procxy.js';
