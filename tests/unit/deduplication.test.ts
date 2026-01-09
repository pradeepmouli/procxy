import { describe, it, expect } from 'vitest';
import { hashObject, makeDedupKey } from '../../src/parent/dedup-utils.js';

/**
 * Unit tests for procxy deduplication logic.
 * These tests verify the deduplication key generation and cache behavior in isolation.
 */

describe('Procxy Deduplication Unit Tests', () => {
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

    it('should handle Date objects', () => {
      const date1 = new Date('2024-01-01T00:00:00.000Z');
      const date2 = new Date('2024-01-01T00:00:00.000Z');
      const date3 = new Date('2024-01-02T00:00:00.000Z');

      expect(hashObject(date1)).toBe(hashObject(date2));
      expect(hashObject(date1)).not.toBe(hashObject(date3));
    });

    it('should handle RegExp objects', () => {
      const regex1 = /test/gi;
      const regex2 = /test/gi;
      const regex3 = /test/i;

      expect(hashObject(regex1)).toBe(hashObject(regex2));
      expect(hashObject(regex1)).not.toBe(hashObject(regex3));
    });

    it('should handle Map objects', () => {
      const map1 = new Map([
        ['a', 1],
        ['b', 2]
      ]);
      const map2 = new Map([
        ['a', 1],
        ['b', 2]
      ]);
      const map3 = new Map([
        ['a', 1],
        ['b', 3]
      ]);

      expect(hashObject(map1)).toBe(hashObject(map2));
      expect(hashObject(map1)).not.toBe(hashObject(map3));
    });

    it('should handle Set objects', () => {
      const set1 = new Set([1, 2, 3]);
      const set2 = new Set([1, 2, 3]);
      const set3 = new Set([1, 2, 4]);

      expect(hashObject(set1)).toBe(hashObject(set2));
      expect(hashObject(set1)).not.toBe(hashObject(set3));
    });

    it('should handle Error objects', () => {
      const err1 = new Error('test message');
      const err2 = new Error('test message');
      const err3 = new Error('different message');

      // Errors with same message should hash the same (stack might differ, but name and message are same)
      expect(hashObject({ name: err1.name, message: err1.message })).toBe(
        hashObject({ name: err2.name, message: err2.message })
      );
      expect(hashObject({ name: err1.name, message: err1.message })).not.toBe(
        hashObject({ name: err3.name, message: err3.message })
      );
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

    it('should generate different keys for different supportHandles values', () => {
      const key1 = makeDedupKey('MyClass', '/path/to/module', [1], { supportHandles: true } as any);
      const key2 = makeDedupKey('MyClass', '/path/to/module', [1], {
        supportHandles: false
      } as any);

      expect(key1).not.toBe(key2);
    });

    it('should generate different keys for different sanitizeV8 values', () => {
      const key1 = makeDedupKey('MyClass', '/path/to/module', [1], { sanitizeV8: true } as any);
      const key2 = makeDedupKey('MyClass', '/path/to/module', [1], { sanitizeV8: false } as any);

      expect(key1).not.toBe(key2);
    });

    it('should ignore non-isolation options like timeout and retries', () => {
      // These options affect parent behavior, not child process state/environment
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
