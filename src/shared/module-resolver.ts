import { fileURLToPath } from 'url';
import { existsSync, readFileSync } from 'fs';
import { dirname, extname, resolve } from 'path';
import { createRequire } from 'module';
import { ModuleResolutionError } from './errors.js';

/**
 * Lazy-loaded debug logger.
 * Uses debug package if available (enable with DEBUG=procxy:resolver),
 * falls back to PROCXY_DEBUG_STACK=1 env check, or no-ops.
 */
let debugLog: (msg: string) => void;

function getDebugLogger(): (msg: string) => void {
  if (debugLog) return debugLog;

  // Try to use debug package if available (optional dependency)
  try {
    const createDebug = require('debug');
    debugLog = createDebug('procxy:resolver');
  } catch {
    // Fallback to env-based logging
    if (process.env['PROCXY_DEBUG_STACK'] === '1') {
      debugLog = (msg: string) => console.warn(`[procxy] ${msg}`);
    } else {
      debugLog = () => {}; // no-op
    }
  }

  return debugLog;
}

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

  const debug = getDebugLogger();
  debug('module resolver stack:\n' + (err.stack ?? '(no stack)'));

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

    // Skip procxy library internal frames (src/ or dist/ directories)
    // Be precise to avoid skipping user files in projects named "procxy"
    if (
      filePath.includes('/src/parent/') ||
      filePath.includes('/src/child/') ||
      filePath.includes('/src/shared/') ||
      filePath.includes('/src/types/') ||
      filePath.includes('/dist/parent/') ||
      filePath.includes('/dist/child/') ||
      filePath.includes('/dist/shared/') ||
      filePath.includes('/dist/types/') ||
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

function normalizeModuleExtension(modulePath: string): {
  jsPath: string;
  tsPath: string;
} {
  const ext = extname(modulePath);
  if (ext.includes('ts')) {
    return {
      tsPath: modulePath,
      jsPath: modulePath.replace(/\.ts$/, '.js')
    };
  } else if (ext.includes('js')) {
    return {
      jsPath: modulePath,
      tsPath: modulePath.replace(/\.js$/, '.ts')
    };
  }
  return {
    jsPath: modulePath + '.js',
    tsPath: modulePath + '.ts'
  };
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
  const tryParse = (pathToParse: string): string | undefined => {
    try {
      const debug = getDebugLogger();
      debug(`parsing caller file: ${pathToParse}`);
      const source = readFileSync(pathToParse, 'utf-8');
      debug(`file content (first 2000 chars):\n${source.slice(0, 2000)}`);
      const callerDir = dirname(pathToParse);
      const requireFromCaller = createRequire(pathToParse);

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
            // Handle bare module specifiers via Node resolution from caller context
            const isBareSpecifier = !importPath.startsWith('.') && !importPath.startsWith('/');
            if (isBareSpecifier) {
              try {
                return requireFromCaller.resolve(importPath);
              } catch {
                // Fall through to relative resolution
              }
            }

            // Resolve relative to caller's directory
            let resolvedPath = resolve(callerDir, importPath);

            // Normalize extensions for TypeScript ESM compatibility
            // TypeScript ESM imports use .js extensions, but files are .ts
            // Return .js path to match import statements (tsx/ts-node maps to .ts at runtime)
            const paths = normalizeModuleExtension(resolvedPath);

            // Prefer .js path for ESM compatibility (tsx handles .js -> .ts mapping)
            // Fall back to .ts if only .ts exists, then to resolved path as last resort
            const debug = getDebugLogger();
            if (existsSync(paths.jsPath)) {
              debug(`resolved module: ${paths.jsPath} (from ${className})`);
              return paths.jsPath;
            } else if (existsSync(paths.tsPath)) {
              debug(`resolved module: ${paths.jsPath} via .ts (from ${className})`);
              return paths.jsPath; // Return .js even if only .ts exists - let tsx handle it
            }

            // If neither exists, return the .js path (matches import statement convention)
            debug(`resolved module (fallback): ${paths.jsPath} (from ${className})`);
            return paths.jsPath;
          }
        }
      }

      // Check if class is defined in the same file
      const classDefPattern = new RegExp(`(?:export\\s+)?class\\s+${className}\\b`);
      if (classDefPattern.test(source)) {
        // Class is defined in the caller file itself
        const debug = getDebugLogger();
        debug(`resolved module: ${pathToParse} (class defined in same file)`);
        return pathToParse;
      }

      return undefined;
    } catch {
      // File read or parse error - fall back to undefined
      return undefined;
    }
  };

  // Try the original caller path first
  const primary = tryParse(callerPath);
  if (primary) return primary;

  // Fallback: if caller is in a build output (bin/dist), map to src/.ts sibling and retry
  if (callerPath.includes('/bin/') || callerPath.includes('/dist/')) {
    const tsCandidate = callerPath.replace(/\/bin\//, '/src/').replace(/\.js$/, '.ts');
    const fallback = tryParse(tsCandidate);
    if (fallback) return fallback;
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
