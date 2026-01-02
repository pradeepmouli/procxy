import { fileURLToPath } from 'url';
import { existsSync, readFileSync } from 'fs';
import { dirname, resolve } from 'path';
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
  explicitModulePath?: string
): {
  modulePath: string;
  className: string;
} {
  // If explicit modulePath provided, use it directly
  if (explicitModulePath) {
    return {
      modulePath: explicitModulePath,
      className
    };
  }

  // Validate class name
  if (!className || className === 'Function') {
    throw new ModuleResolutionError(
      className,
      'Constructor must be a named class (not an anonymous function)',
      { receivedName: className }
    );
  }

  // Attempt stack trace inspection to get caller file
  const callerPath = detectCallerPathFromStackTrace(_constructor);

  if (callerPath) {
    // Try to parse the caller file to find where the class is imported from
    const detectedPath = parseCallerFileForClassPath(callerPath, className);
    if (detectedPath) {
      return { modulePath: detectedPath, className };
    }
  }

  // All strategies failed
  throw new ModuleResolutionError(
    className,
    'Could not determine module path from stack trace or source parsing. Provide explicit modulePath in ProcxyOptions.'
  );
}

/**
 * Detects the caller's file path from Error stack trace.
 * Parses the stack to find the file that called procxy().
 *
 * Handles both ESM (file://) and CommonJS (/path/to) formats.
 * Skips frames from procxy library itself and internal utilities.
 *
 * @returns Caller file path if detected, undefined otherwise
 */
function detectCallerPathFromStackTrace(_constructor?: Function): string | undefined {
  const err = new Error('resolveModulePath', { cause: _constructor });
  Error.captureStackTrace(err, detectCallerPathFromStackTrace);

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

    // Skip procxy library internal frames (src/ directory only)
    // Be precise to avoid skipping user files in projects named "procxy"
    if (
      filePath.includes('/src/parent/') ||
      filePath.includes('/src/child/') ||
      filePath.includes('/src/shared/') ||
      filePath.includes('/src/types/') ||
      filePath.includes('module-resolver')
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
 * Parses the caller's source file to find where a class is imported from or defined.
 *
 * Looks for:
 * 1. ESM import statements: `import { ClassName } from './path'`
 * 2. CommonJS require: `const { ClassName } = require('./path')`
 * 3. Default imports: `import ClassName from './path'`
 * 4. Class declarations in the same file
 *
 * @param callerPath - Path to the file that called procxy()
 * @param className - Name of the class to find
 * @returns Resolved absolute path to the module, or undefined if not found
 */
function parseCallerFileForClassPath(callerPath: string, className: string): string | undefined {
  try {
    const source = readFileSync(callerPath, 'utf-8');
    const callerDir = dirname(callerPath);

    // Patterns to match import/require statements
    const patterns = [
      // ESM named import: import { ClassName } from './path'
      new RegExp(`import\\s+{[^}]*\\b${className}\\b[^}]*}\\s+from\\s+['"]([^'"]+)['"]`, 'g'),

      // ESM default import: import ClassName from './path'
      new RegExp(`import\\s+${className}\\s+from\\s+['"]([^'"]+)['"]`, 'g'),

      // ESM namespace import as: import * as name from './path' (less common for classes)
      new RegExp(
        `import\\s+\\*\\s+as\\s+\\w+\\s+from\\s+['"]([^'"]+)['"].*\\b${className}\\b`,
        'g'
      ),

      // CommonJS require: const { ClassName } = require('./path')
      new RegExp(
        `(?:const|let|var)\\s+{[^}]*\\b${className}\\b[^}]*}\\s*=\\s*require\\(['"]([^'"]+)['"]\\)`,
        'g'
      ),

      // CommonJS require default: const ClassName = require('./path')
      new RegExp(`(?:const|let|var)\\s+${className}\\s*=\\s*require\\(['"]([^'"]+)['"]\\)`, 'g')
    ];

    for (const pattern of patterns) {
      const matches = [...source.matchAll(pattern)];
      for (const match of matches) {
        const importPath = match[1];
        if (importPath) {
          // Resolve relative to caller's directory
          const resolvedPath = resolve(callerDir, importPath);

          // Add .ts/.js extension if not present
          if (!importPath.match(/\.(ts|js|mts|cts|mjs|cjs)$/)) {
            // Try .ts first (TypeScript), then .js
            const tsPath = resolvedPath + '.ts';
            const jsPath = resolvedPath + '.js';

            if (existsSync(tsPath)) {
              return tsPath;
            } else if (existsSync(jsPath)) {
              return jsPath;
            }

            // If neither exists, return .ts (maintains behavior for tsx execution)
            return tsPath;
          }

          return resolvedPath;
        }
      }
    }

    // Check if class is defined in the same file
    const classDefPattern = new RegExp(`(?:export\\s+)?class\\s+${className}\\b`);
    if (classDefPattern.test(source)) {
      // Class is defined in the caller file itself
      return callerPath;
    }

    return undefined;
  } catch {
    // File read or parse error - fall back to undefined
    return undefined;
  }
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
