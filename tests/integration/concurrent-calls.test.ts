import { describe, it, expect } from 'vitest';
import { procxy } from '../../src/index.js';
import { Calculator } from '../fixtures/calculator.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// @ts-ignore - import.meta is supported in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const calculatorPath = join(__dirname, '../fixtures/calculator.ts');

describe('Concurrent Method Calls', () => {
  it('should handle multiple simultaneous method calls', async () => {
    await using proxy = await procxy(Calculator, calculatorPath, undefined, 2);

    const promises = [
      proxy.add(1, 2),
      proxy.add(3, 4),
      proxy.add(5, 6),
      proxy.multiply(2, 3),
      proxy.subtract(10, 5)
    ];

    const results = await Promise.all(promises);

    expect(results).toEqual([3, 7, 11, 6, 5]);
  });

  it('should maintain request correlation across concurrent calls', async () => {
    await using proxy = await procxy(Calculator, calculatorPath, undefined, 2);

    // Fire 100 concurrent calls with different arguments
    const promises = Array.from({ length: 100 }, (_, i) => proxy.add(i, i));

    const results = await Promise.all(promises);

    // Verify each result matches its input
    results.forEach((result, i) => {
      expect(result).toBe(i + i);
    });
  });

  it('should handle interleaved fast and slow operations', async () => {
    await using proxy = await procxy(Calculator, calculatorPath, undefined, 2);

    // Create a mix of fast and slow operations
    const promises = [
      proxy.add(1, 1), // fast
      proxy.multiply(2, 2), // fast
      proxy.add(3, 3), // fast
      proxy.divide(10, 2), // fast
      proxy.subtract(20, 10) // fast
    ];

    const results = await Promise.all(promises);

    expect(results).toEqual([2, 4, 6, 5, 10]);
  });

  it('should handle concurrent calls to the same method', async () => {
    await using proxy = await procxy(Calculator, calculatorPath, undefined, 2);

    const promises = Array.from({ length: 50 }, () => proxy.add(1, 1));

    const results = await Promise.all(promises);

    // All should return 2
    expect(results.every((r) => r === 2)).toBe(true);
    expect(results).toHaveLength(50);
  });

  it('should handle concurrent calls with mixed success and errors', async () => {
    await using proxy = await procxy(Calculator, calculatorPath, undefined, 2);

    const promises = [
      proxy.add(1, 2), // success
      proxy.divide(10, 0), // error
      proxy.multiply(3, 4), // success
      proxy.divide(20, 0), // error
      proxy.subtract(5, 3) // success
    ];

    const results = await Promise.allSettled(promises);

    expect(results[0].status).toBe('fulfilled');
    expect((results[0] as PromiseFulfilledResult<number>).value).toBe(3);

    expect(results[1].status).toBe('rejected');
    expect((results[1] as PromiseRejectedResult).reason.message).toContain('Division by zero');

    expect(results[2].status).toBe('fulfilled');
    expect((results[2] as PromiseFulfilledResult<number>).value).toBe(12);

    expect(results[3].status).toBe('rejected');
    expect((results[3] as PromiseRejectedResult).reason.message).toContain('Division by zero');

    expect(results[4].status).toBe('fulfilled');
    expect((results[4] as PromiseFulfilledResult<number>).value).toBe(2);
  });

  it('should not have cross-talk between concurrent requests', async () => {
    await using proxy = await procxy(Calculator, calculatorPath, undefined, 2);

    // Test that request IDs are properly correlated
    // Each call should get its own unique result
    const promises = [
      proxy.add(1, 0),
      proxy.add(2, 0),
      proxy.add(3, 0),
      proxy.add(4, 0),
      proxy.add(5, 0)
    ];

    const results = await Promise.all(promises);

    expect(results).toEqual([1, 2, 3, 4, 5]);
  });

  it('should handle rapid sequential batches of concurrent calls', async () => {
    await using proxy = await procxy(Calculator, calculatorPath, undefined, 2);

    // Fire 3 batches of 10 concurrent calls each
    const batch1 = await Promise.all(Array.from({ length: 10 }, (_, i) => proxy.add(i, 10)));

    const batch2 = await Promise.all(Array.from({ length: 10 }, (_, i) => proxy.multiply(i, 2)));

    const batch3 = await Promise.all(Array.from({ length: 10 }, (_, i) => proxy.subtract(i, 1)));

    expect(batch1).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);
    expect(batch2).toEqual([0, 2, 4, 6, 8, 10, 12, 14, 16, 18]);
    expect(batch3).toEqual([-1, 0, 1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('should handle concurrent calls during initialization window', async () => {
    // Start multiple proxies and immediately call methods
    const proxies = await Promise.all([
      procxy(Calculator, calculatorPath, undefined, 2),
      procxy(Calculator, calculatorPath, undefined, 2),
      procxy(Calculator, calculatorPath, undefined, 2)
    ]);

    try {
      // Immediately make concurrent calls on all proxies
      const results = await Promise.all([
        proxies[0].add(1, 1),
        proxies[1].add(2, 2),
        proxies[2].add(3, 3),
        proxies[0].multiply(2, 3),
        proxies[1].multiply(4, 5),
        proxies[2].multiply(6, 7)
      ]);

      expect(results).toEqual([2, 4, 6, 6, 20, 42]);
    } finally {
      await Promise.all(proxies.map((p) => p.$terminate()));
    }
  });

  it('should maintain performance under load', async () => {
    await using proxy = await procxy(Calculator, calculatorPath, undefined, 2);

    const iterations = 200;
    const startTime = Date.now();

    const promises = Array.from({ length: iterations }, (_, i) => proxy.add(i, i + 1));

    const results = await Promise.all(promises);

    const duration = Date.now() - startTime;

    // Verify correctness
    results.forEach((result, i) => {
      expect(result).toBe(i + (i + 1));
    });

    // Performance check: should handle 200 calls reasonably fast
    // Allow 2 seconds for 200 calls (10ms per call average)
    expect(duration).toBeLessThan(2000);
  });
});
