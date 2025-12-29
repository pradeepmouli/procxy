import { fileURLToPath } from 'url';
import { ModuleResolutionError } from './errors.js';

/**
 * Module path resolution utilities for Procxy.
 * Automatically detects module path from constructor or uses explicit override.
 */

/**
 * Resolves the module path and class name from a constructor function.
 * Uses Error stack trace inspection with fallback to explicit modulePath option.
 *
 * Fallback strategy:
 * 1. Attempt stack trace inspection to auto-detect module path
 * 2. Fall back to explicit options.modulePath if provided
 * 3. Throw ModuleResolutionError if both fail
 *
 * @param constructor - The class constructor to resolve
 * @param className - The name of the class (from constructor.name)
 * @param explicitModulePath - Optional explicit module path override
 * @returns Object with resolved modulePath and className
 * @throws ModuleResolutionError if module path cannot be determined
 */
export function resolveConstructorModule(
  _constructor: Function,
  className: string,
  explicitModulePath?: string,
): {
  modulePath: string;
  className: string;
} {
  // If explicit modulePath provided, use it directly
  if (explicitModulePath) {
    return {
      modulePath: explicitModulePath,
      className,
    };
  }

  // Validate class name
  if (!className || className === 'Function') {
    throw new ModuleResolutionError(
      className,
      'Constructor must be a named class (not an anonymous function)',
      { receivedName: className },
    );
  }

  // Attempt stack trace inspection
  const modulePath = detectModulePathFromStackTrace();

  if (modulePath) {
    return { modulePath, className };
  }

  // All strategies failed
  throw new ModuleResolutionError(
    className,
    'Could not determine module path from stack trace. Provide explicit modulePath in ProcxyOptions.',
  );
}

/**
 * Detects module path from Error stack trace.
 * Parses the stack to find the caller's file path.
 *
 * Handles both ESM (file://) and CommonJS (/path/to) formats.
 * Skips frames from procxy library itself and internal utilities.
 *
 * @returns Module path if detected, undefined otherwise
 */
function detectModulePathFromStackTrace(): string | undefined {
  const err = new Error();
  Error.captureStackTrace(err, detectModulePathFromStackTrace);

  const stack = err.stack?.split('\n') ?? [];

  // Find the first frame that is not from procxy internals
  for (const frame of stack) {
    // Match stack frames in format:
    // - at Object.<anonymous> (/path/to/file.ts:10:15)
    // - at /path/to/file.ts:10:15
    // - at ClassName.methodName (/path/to/file.ts:10:15)
    const pathMatch = frame.match(/\(([^)]+?):(\d+):(\d+)\)|at\s+([^:(\s]+?):(\d+):(\d+)/);

    if (!pathMatch) continue;

    let filePath = pathMatch[1] || pathMatch[4];

    // Skip if no path found
    if (!filePath) continue;

    // Skip internal Node.js frames (like "new Promise (<anonymous>)")
    if (filePath.includes('<anonymous>') || filePath.includes('node:internal')) {
      continue;
    }

    // Skip procxy internal frames
    if (
      filePath.includes('procxy') ||
      filePath.includes('module-resolver') ||
      filePath.includes('shared')
    ) {
      continue;
    }

    // Convert file:// URLs to file paths for ESM
    if (filePath.startsWith('file://')) {
      try {
        filePath = fileURLToPath(filePath.split(':')[0] ? filePath : `file://${filePath}`);
      } catch {
        // If conversion fails, use the path as-is
      }
    }

    return filePath;
  }

  return undefined;
}

/**
 * Validates that a module path is accessible.
 * Used during child process initialization.
 *
 * @param modulePath - Path to validate
 * @returns true if path appears valid, false otherwise
 */
export function isValidModulePath(modulePath: string): boolean {
  // Basic validation: non-empty, not a function name
  if (!modulePath || typeof modulePath !== 'string') {
    return false;
  }

  // Should not look like code
  if (modulePath.includes('function') || modulePath.includes('class')) {
    return false;
  }

  return true;
}
