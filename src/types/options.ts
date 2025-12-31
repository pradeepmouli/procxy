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
 */
export interface ProcxyOptions {
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
  serialization?: SerializationMode;
}
