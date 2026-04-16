/**
 * Custom error classes for Procxy.
 * Each error type provides context-specific information for better debugging.
 */

/**
 * Base class for all errors thrown by Procxy.
 *
 * @remarks
 * Every error thrown by the `procxy` library extends `ProcxyError`. Catching this
 * base class lets you distinguish library errors from unrelated runtime errors
 * without importing each subclass.
 *
 * All subclasses capture a clean stack trace pointing to the call site via
 * `Error.captureStackTrace`, so the error message and stack are not polluted by
 * internal library frames.
 *
 * @example
 * ```typescript
 * import { procxy, ProcxyError } from 'procxy';
 * import { MyWorker } from './worker.js';
 *
 * try {
 *   const worker = await procxy(MyWorker);
 *   await worker.doWork();
 * } catch (err) {
 *   if (err instanceof ProcxyError) {
 *     console.error('Procxy error:', err.message, err.context);
 *   } else {
 *     throw err; // unrelated error — re-throw
 *   }
 * }
 * ```
 *
 * @category Errors
 * @see {@link TimeoutError} — method call exceeded timeout
 * @see {@link ChildCrashedError} — child process exited unexpectedly
 * @see {@link SerializationError} — argument or return value is not serializable
 * @see {@link ModuleResolutionError} — module path could not be determined
 * @see {@link OptionsValidationError} — invalid option value passed to `procxy()`
 */
export class ProcxyError extends Error {
  constructor(
    message: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ProcxyError';
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Thrown when a proxied method call or the INIT handshake exceeds the configured timeout.
 *
 * @remarks
 * **The child process is NOT killed when this error is thrown.** Only the Promise for
 * the timed-out call is rejected. The child continues running and future calls succeed
 * once it becomes responsive again. If you need to shut down an unresponsive child,
 * call `$terminate()` explicitly after catching this error.
 *
 * The timeout clock starts when the IPC call is dispatched and stops when the response
 * arrives. It does not account for queueing: if `retries` is set, the full timeout is
 * applied per attempt, so total wait = `timeout * (retries + 1)`.
 *
 * @example
 * ```typescript
 * import { procxy, TimeoutError } from 'procxy';
 * import { SlowWorker } from './slow-worker.js';
 *
 * const worker = await procxy(SlowWorker, { timeout: 5_000, retries: 0 });
 * try {
 *   await worker.longOperation();
 * } catch (err) {
 *   if (err instanceof TimeoutError) {
 *     console.error(`${err.methodName} timed out after ${err.timeoutMs}ms`);
 *     await worker.$terminate(); // optional: kill the stuck child
 *   }
 * }
 * ```
 *
 * @category Errors
 */
export class TimeoutError extends ProcxyError {
  constructor(
    /** Name of the method or phase (e.g. `'init'`) that timed out */
    public readonly methodName: string,
    /** Timeout threshold in milliseconds as configured via the `timeout` field in {@link ProcxyOptions} */
    public readonly timeoutMs: number,
    context?: Record<string, unknown>
  ) {
    super(
      `Method '${methodName}' timed out after ${timeoutMs}ms. The child process continues running.`,
      context
    );
    this.name = 'TimeoutError';
  }
}

/**
 * Thrown when procxy cannot determine the file path of the class's module.
 *
 * @remarks
 * Automatic module resolution works by inspecting the call stack and parsing import
 * statements in the caller's source file. It fails in several common scenarios:
 *
 * - The class is dynamically constructed or passed through several abstraction layers,
 *   so the call stack no longer contains a frame in the file that imports the class
 * - Source files are transpiled to a temp directory that does not match the import path
 * - The class is defined inline in the same file without an import
 * - Bundlers inline all modules, making individual file paths unavailable
 *
 * The fix is always to pass `modulePath` explicitly:
 * ```typescript
 * await procxy(MyClass, new URL('./my-class.js', import.meta.url).pathname);
 * // or
 * await procxy(MyClass, { modulePath: './my-class.js' });
 * ```
 *
 * @example
 * ```typescript
 * import { procxy, ModuleResolutionError } from 'procxy';
 * import { Worker } from './worker.js';
 *
 * try {
 *   const w = await procxy(Worker);
 * } catch (err) {
 *   if (err instanceof ModuleResolutionError) {
 *     console.error(`Could not find module for ${err.className}: ${err.reason}`);
 *     // Fix: pass an explicit path
 *   }
 * }
 * ```
 *
 * @category Errors
 */
export class ModuleResolutionError extends ProcxyError {
  constructor(
    /** Name of the class whose module path could not be resolved */
    public readonly className: string,
    /** Human-readable explanation of why resolution failed */
    public readonly reason: string,
    context?: Record<string, unknown>
  ) {
    super(
      `Failed to resolve module path for class '${className}': ${reason}. ` +
        `Provide 'modulePath' explicitly in ProcxyOptions.`,
      context
    );
    this.name = 'ModuleResolutionError';
  }
}

/**
 * Thrown when the child process exits or is killed while the proxy is active.
 *
 * @remarks
 * When a child crash is detected, **all in-flight method calls** are immediately rejected
 * with this error. The proxy object becomes inert — subsequent calls also reject until you
 * create a new proxy with `procxy()` again.
 *
 * Common causes:
 * - An uncaught exception or unhandled rejection inside the child class
 * - OOM kill from the OS
 * - An external `SIGKILL` / `SIGTERM` signal
 * - Calling `$terminate()` from the parent
 *
 * After catching this error, inspect `exitCode` and `signal` to determine whether the crash
 * was expected (e.g., `signal === 'SIGTERM'` after you called `$terminate()`) or unexpected.
 *
 * @example
 * ```typescript
 * import { procxy, ChildCrashedError } from 'procxy';
 * import { MyWorker } from './worker.js';
 *
 * const worker = await procxy(MyWorker);
 * try {
 *   await worker.doWork();
 * } catch (err) {
 *   if (err instanceof ChildCrashedError) {
 *     console.error(
 *       `Child exited: code=${err.exitCode}, signal=${err.signal}`
 *     );
 *     // Spawn a fresh proxy if you need to recover
 *   }
 * }
 * ```
 *
 * @category Errors
 */
export class ChildCrashedError extends ProcxyError {
  constructor(
    /** Process exit code, or `null` if the process was terminated by a signal */
    public readonly exitCode?: number | null,
    /** Signal name (e.g. `'SIGTERM'`) that terminated the process, or `null` if it exited normally */
    public readonly signal?: string | null,
    context?: Record<string, unknown>
  ) {
    const reason = signal
      ? `received signal ${signal}`
      : `exited with code ${exitCode ?? 'unknown'}`;
    super(
      `Child process crashed: ${reason}. All pending method calls have been rejected.`,
      context
    );
    this.name = 'ChildCrashedError';
  }
}

/**
 * Thrown when a constructor argument, method argument, or return value cannot be serialized across the IPC boundary.
 *
 * @remarks
 * In `'json'` mode (the default), all values must be `JSON.stringify`-able. This means
 * `undefined`, functions, `Symbol`, `BigInt`, `Date`, `Map`, `Set`, `Buffer`, and class
 * instances (other than plain objects) will throw unless they happen to be JSON-compatible.
 *
 * In `'advanced'` mode, all values must be V8-structured-clone-compatible (see
 * {@link V8Serializable}). Functions and Symbols still cause this error.
 *
 * The `context_` property names the serialization site (`"constructor arguments"`,
 * `"constructor arguments[0]"`, etc.) for precise debugging without needing a stack trace.
 *
 * @example
 * ```typescript
 * import { procxy, SerializationError } from 'procxy';
 * import { MyWorker } from './worker.js';
 *
 * try {
 *   // Will throw: functions are not JSON-serializable
 *   const w = await procxy(MyWorker, './worker.js', undefined, () => {});
 * } catch (err) {
 *   if (err instanceof SerializationError) {
 *     console.error(`Serialization failed at ${err.context_}:`, err.value);
 *   }
 * }
 * ```
 *
 * @category Errors
 */
export class SerializationError extends ProcxyError {
  constructor(
    /** The value that failed serialization */
    public readonly value: unknown,
    /** Description of where in the call the failure occurred (e.g. `"constructor arguments[0]"`) */
    public readonly context_: string, // renamed to avoid shadowing
    context?: Record<string, unknown>
  ) {
    super(
      `Cannot serialize ${context_}: ${formatValue(value)}. ` +
        `Only JSON-serializable values (Jsonifiable) are supported.`,
      context
    );
    this.name = 'SerializationError';
  }
}

/**
 * Thrown when a value in {@link ProcxyOptions} fails validation before the child process is spawned.
 *
 * @remarks
 * Validation runs synchronously at the start of `procxy()`, so this error is always thrown
 * before any child process is spawned. It is safe to inspect and retry with corrected options.
 *
 * Validated fields and their constraints:
 * - `timeout`: must be a positive number
 * - `retries`: must be a non-negative integer
 * - `cwd`: must be a path to an existing directory
 * - `env`: all values must be strings
 * - `serialization`: must be `'json'` or `'advanced'`
 * - `args`: each element must be serializable under the active mode
 *
 * @example
 * ```typescript
 * import { procxy, OptionsValidationError } from 'procxy';
 * import { MyWorker } from './worker.js';
 *
 * try {
 *   await procxy(MyWorker, { timeout: -1 }); // negative timeout
 * } catch (err) {
 *   if (err instanceof OptionsValidationError) {
 *     console.error(`Bad option "${err.optionName}": ${err.reason}`);
 *     // err.optionValue contains the invalid value
 *   }
 * }
 * ```
 *
 * @category Errors
 */
export class OptionsValidationError extends ProcxyError {
  constructor(
    /** The name of the option that failed validation (e.g. `'timeout'`, `'cwd'`) */
    public readonly optionName: string,
    /** The invalid value that was provided */
    public readonly optionValue: unknown,
    /** Human-readable explanation of what constraint was violated */
    public readonly reason: string,
    context?: Record<string, unknown>
  ) {
    super(
      `ProcxyOptions.${optionName} is invalid: ${reason}. ` +
        `Received: ${formatValue(optionValue)}`,
      context
    );
    this.name = 'OptionsValidationError';
  }
}

/**
 * Helper function to format values for error messages.
 * Truncates large objects to avoid excessive message length.
 */
function formatValue(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return `"${value.slice(0, 50)}"`;
  if (typeof value === 'function') return `[Function: ${(value as Function).name || 'anonymous'}]`;
  try {
    const str = JSON.stringify(value);
    return str.length > 100 ? `${str.slice(0, 97)}...` : str;
  } catch {
    return Object.prototype.toString.call(value);
  }
}
