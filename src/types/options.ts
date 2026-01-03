import type { Jsonifiable } from 'type-fest';

/**
 * Serialization mode for IPC messages.
 * - 'json': JSON serialization (default, backward compatible)
 * - 'advanced': V8 structured clone algorithm (supports Buffer, Map, Set, BigInt, etc.)
 */
export type SerializationMode = 'json' | 'advanced';

/**
 * Configuration options for procxy() function.
 *
 * Allows fine-grained control over child process creation, timeouts, and module resolution.
 *
 * @template Mode - Serialization mode: 'json' | 'advanced'
 * @template SupportHandles - Whether handle passing is enabled (literal boolean)
 */
export type ProcxyOptions<
  Mode extends SerializationMode = 'json',
  SupportHandles extends boolean = false
> = {
  /**
   * Path to the module containing the class.
   * Can be specified here or as the second parameter to procxy().
   *
   * If not provided, procxy will attempt to auto-detect the module path
   * from the class constructor's source location.
   *
   * @default undefined (auto-detect from class)
   */
  modulePath?: string;

  /**
   * Arguments to pass to the child process (via process.argv).
   * All values must be JSON-serializable (type-fest's Jsonifiable).
   *
   * @default undefined
   */
  args?: [...Jsonifiable[]];

  /**
   * Environment variables for the child process.
   * All values must be strings.
   *
   * @default undefined (inherits parent's environment)
   */
  env?: Record<string, string>;

  /**
   * Working directory for the child process.
   * Must be an absolute path to an existing directory.
   *
   * @default undefined (inherits parent's cwd)
   */
  cwd?: string;

  /**
   * Timeout in milliseconds for each remote method call.
   * When timeout expires, the Promise is rejected with TimeoutError.
   * The child process continues running (is not killed).
   *
   * @default 30000 (30 seconds)
   */
  timeout?: number;

  /**
   * Number of retry attempts per method call (in addition to the initial attempt).
   * For example, retries: 3 means 4 total attempts (1 initial + 3 retries).
   * Each retry uses the same timeout, so total time = timeout * (retries + 1).
   *
   * @default 3
   */
  retries?: number;

  /**
   * Serialization mode for IPC messages between parent and child processes.
   * - 'json': Uses JSON.stringify/parse (default). Supports primitive types, objects, arrays.
   * - 'advanced': Uses V8 structured clone algorithm. Supports Buffer, TypedArray, Map, Set,
   *   BigInt, Date, RegExp, Error, and more complex types.
   *
   * @default 'json'
   *
   * @remarks
   * When using 'advanced' mode, method parameters and return values can include:
   * - Binary data: Buffer, ArrayBuffer, TypedArray (Uint8Array, Int32Array, etc.)
   * - Collections: Map, Set with proper fidelity
   * - BigInt values
   * - Error instances with full properties
   * - Date and RegExp objects
   *
   * 'json' mode is faster for simple objects but cannot handle these types.
   */

  /**
   * Forward child process stdout and stderr to parent's stdout and stderr.
   * When enabled, all console.log(), console.error(), and other output from the child
   * process will be displayed in the parent process in real-time.
   *
   * @default false
   */
  interleaveOutput?: boolean;
} & (Mode extends 'advanced'
  ? {
      serialization: 'advanced';
      /**
       * Enable handle passing support in advanced serialization mode.
       * Allows passing of certain resource handles (e.g., net.Socket) between
       * parent and child processes.
       *
       * Use `as const` for literal type inference:
       * ```typescript
       * { serialization: 'advanced', supportHandles: true } as const
       * ```
       *
       * @default false
       *
       * @remarks
       * This option is only valid when serialization mode is 'advanced'.
       * It enables special handling for supported handle types.
       */
      supportHandles?: SupportHandles;

      /**
       * Automatically sanitize constructor arguments to remove non-V8-serializable properties.
       * When enabled, properties that cannot be serialized (functions, getters, etc.) are
       * automatically stripped from objects before being sent to the child process.
       *
       * Sanitization is lazy: it only happens if the initial validation fails, avoiding
       * unnecessary overhead for objects that are already V8-serializable.
       *
       * **Type Safety**: Constructor arguments are now constrained to V8Serializable types
       * at compile time. However, TypeScript cannot deeply validate nested object properties
       * due to structural typing (objects with methods still match `{ [key: string]: any }`).
       * Use this option as a runtime safety net for edge cases like:
       * - Objects with hidden getters/setters
       * - Third-party library objects with methods
       * - Configuration objects from external sources
       *
       * @default false
       *
       * @example
       * ```typescript
       * // TypeScript will catch this:
       * await procxy(MyClass, './module.js', {
       *   serialization: 'advanced'
       * } as const, () => {}); // ❌ Type error: function not V8Serializable
       *
       * // But nested properties may not be caught:
       * await procxy(MyClass, './module.js', {
       *   serialization: 'advanced',
       *   sanitizeV8: true  // Runtime safety for nested props
       * } as const, { config: { handler: () => {} } }); // ✓ Compiles, sanitized at runtime
       * ```
       *
       * @remarks
       * - When false (default): validation fails if any property is non-serializable
       * - When true: non-serializable properties are automatically removed on validation failure
       * - Only applies to constructor arguments
       * - Method arguments still require all properties to be serializable
       * - TypeScript enforces top-level arg types but not deep object properties
       */
      sanitizeV8?: boolean;
    }
  : { serialization?: 'json' });
