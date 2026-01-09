import { createHash } from 'node:crypto';
import type { ProcxyOptions } from '../types/options.js';

/**
 * Recursively sort object keys for stable hashing
 * Handles special object types (Date, RegExp, Error, Map, Set) appropriately
 */
export function sortKeys(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sortKeys(item));
  }

  // Handle special object types
  if (obj instanceof Date) {
    return obj.toISOString();
  }

  if (obj instanceof RegExp) {
    return obj.toString();
  }

  if (obj instanceof Map) {
    return Array.from(obj.entries()).map(([k, v]) => [k, sortKeys(v)]);
  }

  if (obj instanceof Set) {
    return Array.from(obj.values()).map((v) => sortKeys(v));
  }

  if (obj instanceof Error) {
    return {
      name: obj.name,
      message: obj.message,
      stack: obj.stack
    };
  }

  if (typeof obj === 'object') {
    return Object.keys(obj)
      .sort()
      .reduce((sorted: any, key: string) => {
        sorted[key] = sortKeys(obj[key]);
        return sorted;
      }, {});
  }

  return obj;
}

/**
 * Create a stable hash of an object for cache key generation.
 * Returns a consistent hash for the same input, regardless of property order.
 */
export function hashObject(obj: any): string {
  if (obj === undefined || obj === null) {
    return 'null';
  }

  try {
    // Create a stable string representation by sorting keys recursively
    const sortedObj = sortKeys(obj);
    const str = JSON.stringify(sortedObj);
    return createHash('sha256').update(str).digest('hex');
  } catch {
    // If serialization fails, return a random hash to disable deduplication for this case
    return `unstable-${Math.random().toString(36).substring(2, 15)}`;
  }
}

/**
 * Create a deduplication key that includes constructor args and isolation-affecting options.
 * Options that affect child process behavior (env, cwd, args, serialization, supportHandles, sanitizeV8)
 * are included to ensure separate child processes are created when these differ.
 */
export function makeDedupKey(
  className: string,
  modulePath: string,
  constructorArgs: any[],
  options?: ProcxyOptions
): string {
  // Extract options that affect child process isolation
  const isolationOptions = {
    env: options?.env,
    cwd: options?.cwd,
    args: options?.args,
    serialization: options?.serialization,
    supportHandles: (options as any)?.supportHandles,
    sanitizeV8: (options as any)?.sanitizeV8
  };

  const optionsHash = hashObject(isolationOptions);
  const argsHash = hashObject(constructorArgs);

  return `${className}:${modulePath}:${optionsHash}:${argsHash}`;
}
