import { createHash } from 'node:crypto';
import type { ProcxyOptions } from '../types/options.js';

/**
 * Recursively sort object keys for stable hashing
 * Handles special object types (Date, RegExp, Error, Map, Set) appropriately
 */
export function sortKeys(obj: any): any {
  const visited = new WeakSet<object>();

  function innerSort(value: any): any {
    if (value === null || value === undefined) {
      return value;
    }

    const valueType = typeof value;
    if (valueType !== 'object') {
      return value;
    }

    // Handle special object types that do not recurse into nested structures
    if (value instanceof Date) {
      return value.toISOString();
    }

    if (value instanceof RegExp) {
      return value.toString();
    }

    if (value instanceof Error) {
      return {
        name: value.name,
        message: value.message,
        stack: value.stack
      };
    }

    // Detect and handle circular references
    if (visited.has(value)) {
      return '[Circular]';
    }
    visited.add(value as object);

    if (Array.isArray(value)) {
      return value.map((item) => innerSort(item));
    }

    if (value instanceof Map) {
      return Array.from(value.entries())
        .sort(([k1], [k2]) => String(k1).localeCompare(String(k2)))
        .map(([k, v]) => [k, innerSort(v)]);
    }

    if (value instanceof Set) {
      return Array.from(value.values())
        .map((v) => innerSort(v))
        .sort((a, b) => {
          const s1 = JSON.stringify(a);
          const s2 = JSON.stringify(b);
          return s1 < s2 ? -1 : s1 > s2 ? 1 : 0;
        });
    }

    if (typeof value === 'object') {
      return Object.keys(value)
        .sort()
        .reduce((sorted: any, key: string) => {
          sorted[key] = innerSort((value as any)[key]);
          return sorted;
        }, {});
    }

    return value;
  }

  return innerSort(obj);
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
