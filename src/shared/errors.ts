/**
 * Custom error classes for Procxy.
 * Each error type provides context-specific information for better debugging.
 */

/**
 * Base error class for all Procxy-related errors.
 * Extends Error and adds context information.
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
 * Thrown when a method call exceeds the configured timeout.
 * The child process is not killed, only the Promise is rejected.
 */
export class TimeoutError extends ProcxyError {
  constructor(
    public readonly methodName: string,
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
 * Thrown when the module path cannot be determined from the constructor.
 * This occurs when automatic stack trace detection fails and no explicit modulePath is provided.
 */
export class ModuleResolutionError extends ProcxyError {
  constructor(
    public readonly className: string,
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
 * Thrown when a child process crashes or exits unexpectedly.
 * All pending method calls are rejected with this error.
 */
export class ChildCrashedError extends ProcxyError {
  constructor(
    public readonly exitCode?: number | null,
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
 * Thrown when constructor arguments or method arguments are not JSON-serializable.
 * Only values that pass JSON.stringify() are supported.
 */
export class SerializationError extends ProcxyError {
  constructor(
    public readonly value: unknown,
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
 * Thrown when ProcxyOptions validation fails.
 * E.g., cwd does not exist, env contains non-string values, etc.
 */
export class OptionsValidationError extends ProcxyError {
  constructor(
    public readonly optionName: string,
    public readonly optionValue: unknown,
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
