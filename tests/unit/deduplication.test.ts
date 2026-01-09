import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';

/**
 * Unit tests for procxy deduplication logic.
 * These tests verify the deduplication key generation and cache behavior in isolation.
 */

describe('Procxy Deduplication Unit Tests', () => {
  /**
   * Hash object helper (mirrors the implementation in procxy.ts)
   */
  function sortKeys(obj: any): any {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => sortKeys(item));
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

  function hashObject(obj: any): string {
    if (obj === undefined || obj === null) {
      return 'null';
    }

    try {
      const sortedObj = sortKeys(obj);
      const str = JSON.stringify(sortedObj);
      return createHash('sha256').update(str).digest('hex').substring(0, 16);
    } catch {
      return `unstable-${Math.random().toString(36).substring(2, 15)}`;
    }
  }

  /**
   * Make dedup key helper (mirrors the implementation in procxy.ts)
   */
  function makeDedupKey(
    className: string,
    modulePath: string,
    constructorArgs: any[],
    options?: any
  ): string {
    const isolationOptions = {
      env: options?.env,
      cwd: options?.cwd,
      args: options?.args,
      serialization: options?.serialization,
      supportHandles: options?.supportHandles,
      sanitizeV8: options?.sanitizeV8
    };

    const optionsHash = hashObject(isolationOptions);
    const argsHash = hashObject(constructorArgs);

    return `${className}:${modulePath}:${optionsHash}:${argsHash}`;
  }

  describe('hashObject', () => {
    it('should return same hash for identical objects', () => {
      const obj1 = { a: 1, b: 2, c: 3 };
      const obj2 = { a: 1, b: 2, c: 3 };

      expect(hashObject(obj1)).toBe(hashObject(obj2));
    });

    it('should return same hash regardless of property order', () => {
      const obj1 = { a: 1, b: 2, c: 3 };
      const obj2 = { c: 3, a: 1, b: 2 };

      expect(hashObject(obj1)).toBe(hashObject(obj2));
    });

    it('should return different hashes for different objects', () => {
      const obj1 = { a: 1, b: 2 };
      const obj2 = { a: 1, b: 3 };

      expect(hashObject(obj1)).not.toBe(hashObject(obj2));
    });

    it('should handle null and undefined', () => {
      expect(hashObject(null)).toBe('null');
      expect(hashObject(undefined)).toBe('null');
    });

    it('should handle nested objects', () => {
      const obj1 = { a: { b: { c: 1 } } };
      const obj2 = { a: { b: { c: 1 } } };
      const obj3 = { a: { b: { c: 2 } } };

      expect(hashObject(obj1)).toBe(hashObject(obj2));
      expect(hashObject(obj1)).not.toBe(hashObject(obj3));
    });

    it('should handle arrays', () => {
      const arr1 = [1, 2, 3];
      const arr2 = [1, 2, 3];
      const arr3 = [3, 2, 1];

      expect(hashObject(arr1)).toBe(hashObject(arr2));
      expect(hashObject(arr1)).not.toBe(hashObject(arr3));
    });
  });

  describe('makeDedupKey', () => {
    it('should generate same key for identical class, module, args, and options', () => {
      const key1 = makeDedupKey('MyClass', '/path/to/module', [1, 2, 3], { env: { FOO: 'bar' } });
      const key2 = makeDedupKey('MyClass', '/path/to/module', [1, 2, 3], { env: { FOO: 'bar' } });

      expect(key1).toBe(key2);
    });

    it('should generate different keys for different class names', () => {
      const key1 = makeDedupKey('Class1', '/path/to/module', [1, 2], undefined);
      const key2 = makeDedupKey('Class2', '/path/to/module', [1, 2], undefined);

      expect(key1).not.toBe(key2);
    });

    it('should generate different keys for different module paths', () => {
      const key1 = makeDedupKey('MyClass', '/path/to/module1', [1, 2], undefined);
      const key2 = makeDedupKey('MyClass', '/path/to/module2', [1, 2], undefined);

      expect(key1).not.toBe(key2);
    });

    it('should generate different keys for different constructor args', () => {
      const key1 = makeDedupKey('MyClass', '/path/to/module', [1, 2, 3], undefined);
      const key2 = makeDedupKey('MyClass', '/path/to/module', [4, 5, 6], undefined);

      expect(key1).not.toBe(key2);
    });

    it('should generate different keys for different env options', () => {
      const key1 = makeDedupKey('MyClass', '/path/to/module', [1], { env: { VAR: 'a' } });
      const key2 = makeDedupKey('MyClass', '/path/to/module', [1], { env: { VAR: 'b' } });

      expect(key1).not.toBe(key2);
    });

    it('should generate different keys for different cwd options', () => {
      const key1 = makeDedupKey('MyClass', '/path/to/module', [1], { cwd: '/dir1' });
      const key2 = makeDedupKey('MyClass', '/path/to/module', [1], { cwd: '/dir2' });

      expect(key1).not.toBe(key2);
    });

    it('should generate different keys for different serialization modes', () => {
      const key1 = makeDedupKey('MyClass', '/path/to/module', [1], { serialization: 'json' });
      const key2 = makeDedupKey('MyClass', '/path/to/module', [1], {
        serialization: 'advanced'
      });

      expect(key1).not.toBe(key2);
    });

    it('should ignore non-isolation options like timeout and retries', () => {
      // These options don't affect child process isolation, so they shouldn't affect the key
      const key1 = makeDedupKey('MyClass', '/path/to/module', [1], { timeout: 1000 });
      const key2 = makeDedupKey('MyClass', '/path/to/module', [1], { timeout: 5000 });

      expect(key1).toBe(key2);
    });

    it('should handle undefined options', () => {
      const key1 = makeDedupKey('MyClass', '/path/to/module', [1], undefined);
      const key2 = makeDedupKey('MyClass', '/path/to/module', [1], undefined);

      expect(key1).toBe(key2);
    });

    it('should handle empty constructor args', () => {
      const key1 = makeDedupKey('MyClass', '/path/to/module', [], undefined);
      const key2 = makeDedupKey('MyClass', '/path/to/module', [], undefined);

      expect(key1).toBe(key2);
    });

    it('should generate same key when args order is same but options property order differs', () => {
      const key1 = makeDedupKey('MyClass', '/path/to/module', [1, 2], {
        env: { A: '1', B: '2' },
        cwd: '/dir'
      });
      const key2 = makeDedupKey('MyClass', '/path/to/module', [1, 2], {
        cwd: '/dir',
        env: { B: '2', A: '1' }
      });

      expect(key1).toBe(key2);
    });
  });

  describe('Cache behavior', () => {
    it('should demonstrate LRU eviction logic', () => {
      const MAX_CACHE_SIZE = 3;
      const cache = new Map<string, any>();
      const insertionOrder: string[] = [];

      function addToCache(key: string, value: any) {
        if (cache.size >= MAX_CACHE_SIZE) {
          // Evict oldest
          const oldestKey = insertionOrder.shift()!;
          cache.delete(oldestKey);
        }
        cache.set(key, value);
        insertionOrder.push(key);
      }

      // Add 4 items to a cache with max size 3
      addToCache('key1', 'value1');
      addToCache('key2', 'value2');
      addToCache('key3', 'value3');
      addToCache('key4', 'value4'); // This should evict key1

      expect(cache.has('key1')).toBe(false); // Evicted
      expect(cache.has('key2')).toBe(true);
      expect(cache.has('key3')).toBe(true);
      expect(cache.has('key4')).toBe(true);
      expect(cache.size).toBe(3);
      expect(insertionOrder).toEqual(['key2', 'key3', 'key4']);
    });
  });
});
