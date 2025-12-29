import type { Jsonifiable } from 'type-fest';

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
   * Explicit module path override.
   * If provided, this path is used to import the class in the child process.
   * This overrides automatic stack trace detection.
   *
   * Should be the absolute path to a JavaScript/TypeScript module
   * that exports the constructor class.
   *
   * @default undefined (auto-detect via stack trace)
   */
  modulePath?: string;
}
