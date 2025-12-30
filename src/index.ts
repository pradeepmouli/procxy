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
export type { ProcxyOptions } from './types/options.js';

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
  ChildToParentMessage
} from './shared/protocol.js';
