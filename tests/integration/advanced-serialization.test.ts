import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { procxy } from '../../src/index.js';
import type { Procxy } from '../../src/types/procxy.js';
import { BinaryProcessor } from '../fixtures/BinaryProcessor.js';

const binaryProcessorPath = resolve(process.cwd(), 'tests/fixtures/BinaryProcessor.ts');

describe('Advanced Serialization Mode - V8 Structured Clone', () => {
  describe('Buffer support', () => {
    it('should handle Buffer arguments and return values', async () => {
      await using proxy = await procxy(BinaryProcessor, {
        modulePath: binaryProcessorPath,
        serialization: 'advanced'
      });

      const input = Buffer.from([0x00, 0x11, 0x22, 0x33]);
      const result = await proxy.processBuffer(input);

      // Result should be XOR with 0xFF
      expect(result).toBeInstanceOf(Buffer);
      expect(result[0]).toBe(0xff);
      expect(result[1]).toBe(0xee);
      expect(result[2]).toBe(0xdd);
      expect(result[3]).toBe(0xcc);
    });

    it('should handle Buffer.from with string', async () => {
      await using proxy: Procxy<BinaryProcessor, 'advanced'> = await procxy(
        BinaryProcessor,
        binaryProcessorPath,
        { serialization: 'advanced' }
      );

      const input = Buffer.from('hello');
      const result = await proxy.processBuffer(input);

      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBe(5);
    });

    it('should cache and retrieve Buffer data', async () => {
      await using proxy: Procxy<BinaryProcessor, 'advanced'> = await procxy(
        BinaryProcessor,
        binaryProcessorPath,
        { serialization: 'advanced' }
      );

      const data = Buffer.from('cached data');
      await proxy.cacheData('key1', data);

      const retrieved = await proxy.getCachedData('key1');
      expect(retrieved).toBeInstanceOf(Buffer);
      expect(retrieved?.toString()).toBe('cached data');
    });
  });

  describe('TypedArray support', () => {
    it('should handle Uint8Array', async () => {
      await using proxy: Procxy<BinaryProcessor, 'advanced'> = await procxy(
        BinaryProcessor,
        binaryProcessorPath,
        { serialization: 'advanced' }
      );

      const input = new Uint8Array([1, 2, 3, 4]);
      const result = await proxy.processTypedArray(input);

      expect(result).toBeInstanceOf(Uint8Array);
      expect(Array.from(result)).toEqual([2, 4, 6, 8]);
    });

    it('should handle Float32Array', async () => {
      await using proxy: Procxy<BinaryProcessor, 'advanced'> = await procxy(
        BinaryProcessor,
        binaryProcessorPath,
        { serialization: 'advanced' }
      );

      const input = new Float32Array([1.1, 2.2, 3.3]);
      const result = await proxy.sumFloat32Array(input);

      expect(result).toBeCloseTo(6.6, 1);
    });

    it('should handle Int32Array', async () => {
      await using proxy: Procxy<BinaryProcessor, 'advanced'> = await procxy(
        BinaryProcessor,
        binaryProcessorPath,
        { serialization: 'advanced' }
      );

      const input = new Int32Array([10, 20, 30, 15]);
      const result = await proxy.maxInt32Array(input);

      expect(result).toBe(30);
    });
  });

  describe('Map support', () => {
    it('should return Map from remote method', async () => {
      await using proxy: Procxy<BinaryProcessor, 'advanced'> = await procxy(
        BinaryProcessor,
        binaryProcessorPath,
        { serialization: 'advanced' }
      );

      await proxy.cacheData('key1', Buffer.from('data1'));
      await proxy.cacheData('key2', Buffer.from('data2'));

      const cache = await proxy.getAllCache();

      expect(cache).toBeInstanceOf(Map);
      expect(cache.size).toBe(2);
      expect(cache.get('key1')?.toString()).toBe('data1');
      expect(cache.get('key2')?.toString()).toBe('data2');
    });

    it('should handle Map as argument', async () => {
      await using proxy: Procxy<BinaryProcessor, 'advanced'> = await procxy(
        BinaryProcessor,
        binaryProcessorPath,
        { serialization: 'advanced' }
      );

      const map = new Map([
        ['a', 1],
        ['b', 2],
        ['c', 3]
      ]);

      const result = await proxy.complexOperation({
        buffer: Buffer.from('test'),
        map: map,
        set: new Set(['x', 'y']),
        bigint: BigInt(100),
        date: new Date('2024-01-01')
      });

      expect(result.mapSize).toBe(3);
    });
  });

  describe('Set support', () => {
    it('should return Set from remote method', async () => {
      await using proxy: Procxy<BinaryProcessor, 'advanced'> = await procxy(
        BinaryProcessor,
        binaryProcessorPath,
        { serialization: 'advanced' }
      );

      await proxy.markProcessed(1);
      await proxy.markProcessed(2);
      await proxy.markProcessed(3);

      const processed = await proxy.getProcessedIds();

      expect(processed).toBeInstanceOf(Set);
      expect(processed.size).toBe(3);
      expect(processed.has(1)).toBe(true);
      expect(processed.has(2)).toBe(true);
      expect(processed.has(3)).toBe(true);
    });

    it('should handle Set operations', async () => {
      await using proxy: Procxy<BinaryProcessor, 'advanced'> = await procxy(
        BinaryProcessor,
        binaryProcessorPath,
        { serialization: 'advanced' }
      );

      await proxy.markProcessed(42);
      expect(await proxy.isProcessed(42)).toBe(true);
      expect(await proxy.isProcessed(99)).toBe(false);
    });

    it('should handle Set as argument', async () => {
      await using proxy: Procxy<BinaryProcessor, 'advanced'> = await procxy(
        BinaryProcessor,
        binaryProcessorPath,
        { serialization: 'advanced' }
      );

      const set = new Set(['apple', 'banana', 'cherry']);

      const result = await proxy.complexOperation({
        buffer: Buffer.from('test'),
        map: new Map([['key', 1]]),
        set: set,
        bigint: BigInt(50),
        date: new Date()
      });

      expect(result.setArray).toEqual(['apple', 'banana', 'cherry']);
    });
  });

  describe('BigInt support', () => {
    it('should handle BigInt arguments and return values', async () => {
      await using proxy: Procxy<BinaryProcessor, 'advanced'> = await procxy(
        BinaryProcessor,
        binaryProcessorPath,
        { serialization: 'advanced' }
      );

      const result = await proxy.multiplyBigInt(BigInt(123), BigInt(456));

      expect(typeof result).toBe('bigint');
      expect(result).toBe(BigInt(56088));
    });

    it('should handle large BigInt values', async () => {
      await using proxy: Procxy<BinaryProcessor, 'advanced'> = await procxy(
        BinaryProcessor,
        binaryProcessorPath,
        { serialization: 'advanced' }
      );

      const largeNumber = BigInt('9007199254740992'); // 2^53
      const result = await proxy.multiplyBigInt(largeNumber, BigInt(2));

      expect(result).toBe(BigInt('18014398509481984'));
    });

    it('should return BigInt from method', async () => {
      await using proxy: Procxy<BinaryProcessor, 'advanced'> = await procxy(
        BinaryProcessor,
        binaryProcessorPath,
        { serialization: 'advanced' }
      );

      const timestamp = await proxy.getNanosTimestamp();

      expect(typeof timestamp).toBe('bigint');
      expect(timestamp > BigInt(0)).toBe(true);
    });
  });

  describe('Date support', () => {
    it('should handle Date arguments and return values', async () => {
      await using proxy: Procxy<BinaryProcessor, 'advanced'> = await procxy(
        BinaryProcessor,
        binaryProcessorPath,
        { serialization: 'advanced' }
      );

      const date = new Date('2024-01-01');
      const result = await proxy.addDays(date, 5);

      expect(result).toBeInstanceOf(Date);
      expect(result.toISOString().slice(0, 10)).toBe('2024-01-06');
    });

    it('should preserve Date object properties', async () => {
      await using proxy: Procxy<BinaryProcessor, 'advanced'> = await procxy(
        BinaryProcessor,
        binaryProcessorPath,
        { serialization: 'advanced' }
      );

      const date = new Date('2024-06-15T12:30:00Z');
      const result = await proxy.addDays(date, 0);

      expect(result).toBeInstanceOf(Date);
      expect(result.getTime()).toBe(date.getTime());
    });
  });

  describe('RegExp support', () => {
    it('should handle RegExp arguments', async () => {
      await using proxy: Procxy<BinaryProcessor, 'advanced'> = await procxy(
        BinaryProcessor,
        binaryProcessorPath,
        { serialization: 'advanced' }
      );

      const pattern = /test/i;
      const result1 = await proxy.testPattern(pattern, 'This is a TEST');
      const result2 = await proxy.testPattern(pattern, 'No match here');

      expect(result1).toBe(true);
      expect(result2).toBe(false);
    });

    it('should handle RegExp with flags', async () => {
      await using proxy: Procxy<BinaryProcessor, 'advanced'> = await procxy(
        BinaryProcessor,
        binaryProcessorPath,
        { serialization: 'advanced' }
      );

      const pattern = new RegExp('\\d+', 'g');
      const result = await proxy.testPattern(pattern, '123abc456');

      expect(result).toBe(true);
    });
  });

  describe('Error support', () => {
    it('should handle Error arguments', async () => {
      await using proxy: Procxy<BinaryProcessor, 'advanced'> = await procxy(
        BinaryProcessor,
        binaryProcessorPath,
        { serialization: 'advanced' }
      );

      const error = new Error('Test error message');
      const result = await proxy.processError(error);

      expect(result.message).toBe('Test error message');
      expect(result.name).toBe('Error');
    });

    it('should handle TypeError', async () => {
      await using proxy: Procxy<BinaryProcessor, 'advanced'> = await procxy(
        BinaryProcessor,
        binaryProcessorPath,
        { serialization: 'advanced' }
      );

      const error = new TypeError('Type error message');
      const result = await proxy.processError(error);

      expect(result.message).toBe('Type error message');
      expect(result.name).toBe('TypeError');
    });
  });

  describe('Complex nested structures', () => {
    it('should handle complex operation with multiple V8 types', async () => {
      await using proxy: Procxy<BinaryProcessor, 'advanced'> = await procxy(
        BinaryProcessor,
        binaryProcessorPath,
        { serialization: 'advanced' }
      );

      const input = {
        buffer: Buffer.from([0x01, 0x02, 0x03]),
        map: new Map([
          ['key1', 10],
          ['key2', 20]
        ]),
        set: new Set(['a', 'b', 'c']),
        bigint: BigInt(999),
        date: new Date('2024-03-15')
      };

      const result = await proxy.complexOperation(input);

      expect(result.processedBuffer).toBeInstanceOf(Buffer);
      expect(result.processedBuffer.length).toBe(3);
      expect(result.mapSize).toBe(2);
      expect(result.setArray).toEqual(['a', 'b', 'c']);
      expect(result.doubleBigInt).toBe(BigInt(1998));
      expect(typeof result.dayOfWeek).toBe('number');
    });
  });

  describe('Backward compatibility', () => {
    it('should still work with JSON-serializable types in advanced mode', async () => {
      await using proxy: Procxy<BinaryProcessor, 'advanced'> = await procxy(
        BinaryProcessor,
        binaryProcessorPath,
        { serialization: 'advanced' }
      );

      // These should work fine even in advanced mode
      await proxy.markProcessed(1);
      expect(await proxy.isProcessed(1)).toBe(true);
    });
  });
});
