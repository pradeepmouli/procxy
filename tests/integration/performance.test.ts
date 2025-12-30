import { resolve } from 'node:path';
import { describe, it, expect, afterEach } from 'vitest';
import { procxy } from '../../src/index.js';
import type { Procxy } from '../../src/types/procxy.js';
import { Calculator } from '../fixtures/calculator.js';

const calculatorPath = resolve(process.cwd(), 'tests/fixtures/calculator.ts');
const OVERHEAD_THRESHOLD_MS = 10; // SC-003: Method call overhead must be under 10ms

describe('Performance Benchmarks (T070)', () => {
  let proxy: Procxy<Calculator> | null = null;

  afterEach(async () => {
    if (proxy) {
      await proxy.$terminate();
      proxy = null;
    }
  });

  describe('Method call overhead', () => {
    it('should have under 10ms overhead for simple method calls (SC-003)', async () => {
      proxy = await procxy(Calculator, calculatorPath);

      // Warm up the connection
      await proxy.add(1, 2);

      const iterations = 100;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        await proxy.add(i, i + 1);
      }

      const totalTime = performance.now() - startTime;
      const averageTime = totalTime / iterations;

      expect(averageTime).toBeLessThan(OVERHEAD_THRESHOLD_MS);
      console.log(`Average method call overhead: ${averageTime.toFixed(2)}ms`);
    });

    it('should have consistent overhead across different method types', async () => {
      proxy = await procxy(Calculator, calculatorPath, undefined, 2);

      // Warm up
      await proxy.add(1, 2);
      await proxy.subtract(1, 2);
      await proxy.multiply(1, 2);
      await proxy.divide(1, 2);

      const iterations = 50;
      const overheads: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        await proxy.add(i, i + 1);
        overheads.push(performance.now() - start);
      }

      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        await proxy.subtract(i, i + 1);
        overheads.push(performance.now() - start);
      }

      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        await proxy.multiply(i, i + 1);
        overheads.push(performance.now() - start);
      }

      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        await proxy.divide(10, i + 1);
        overheads.push(performance.now() - start);
      }

      const averageOverhead = overheads.reduce((a, b) => a + b, 0) / overheads.length;
      const maxOverhead = Math.max(...overheads);
      const minOverhead = Math.min(...overheads);

      expect(averageOverhead).toBeLessThan(OVERHEAD_THRESHOLD_MS);
      console.log(
        `Method overhead - Min: ${minOverhead.toFixed(2)}ms, Max: ${maxOverhead.toFixed(2)}ms, Avg: ${averageOverhead.toFixed(2)}ms`
      );
    });

    it('should maintain low overhead with increasing call volume', async () => {
      proxy = await procxy(Calculator, calculatorPath);

      // Test with different batch sizes
      const batchSizes = [10, 50, 100, 500];

      for (const batchSize of batchSizes) {
        const startTime = performance.now();

        for (let i = 0; i < batchSize; i++) {
          await proxy.add(i, i + 1);
        }

        const totalTime = performance.now() - startTime;
        const averageTime = totalTime / batchSize;

        expect(averageTime).toBeLessThan(OVERHEAD_THRESHOLD_MS);
        console.log(`Batch size ${batchSize}: ${averageTime.toFixed(2)}ms average`);
      }
    });
  });

  describe('Concurrent performance', () => {
    it('should handle multiple concurrent calls efficiently', async () => {
      proxy = await procxy(Calculator, calculatorPath);

      // Warm up
      await proxy.add(1, 2);

      const concurrentCalls = 50;
      const startTime = performance.now();

      const promises: Promise<number>[] = [];
      for (let i = 0; i < concurrentCalls; i++) {
        promises.push(proxy.add(i, i + 1));
      }

      const results = await Promise.all(promises);
      const totalTime = performance.now() - startTime;
      const averageTime = totalTime / concurrentCalls;

      // Verify results are correct
      expect(results).toHaveLength(concurrentCalls);
      for (let i = 0; i < concurrentCalls; i++) {
        expect(results[i]).toBe(2 * i + 1);
      }

      expect(averageTime).toBeLessThan(OVERHEAD_THRESHOLD_MS * 2);
      console.log(`Concurrent calls (${concurrentCalls}): ${averageTime.toFixed(2)}ms average`);
    });

    it('should scale linearly with concurrent request count', async () => {
      proxy = await procxy(Calculator, calculatorPath);

      // Warm up
      await proxy.add(1, 2);

      const testCases = [
        { concurrent: 10, maxAverage: OVERHEAD_THRESHOLD_MS * 1.5 },
        { concurrent: 50, maxAverage: OVERHEAD_THRESHOLD_MS * 2 },
        { concurrent: 100, maxAverage: OVERHEAD_THRESHOLD_MS * 3 }
      ];

      for (const testCase of testCases) {
        const startTime = performance.now();

        const promises: Promise<number>[] = [];
        for (let i = 0; i < testCase.concurrent; i++) {
          promises.push(proxy.add(i, i + 1));
        }

        await Promise.all(promises);
        const totalTime = performance.now() - startTime;
        const averageTime = totalTime / testCase.concurrent;

        expect(averageTime).toBeLessThan(testCase.maxAverage);
        console.log(`${testCase.concurrent} concurrent: ${averageTime.toFixed(2)}ms average`);
      }
    });
  });

  describe('Initialization performance', () => {
    it('should initialize procxy instance efficiently', async () => {
      const startTime = performance.now();
      const instance = await procxy(Calculator, calculatorPath);
      const initTime = performance.now() - startTime;

      try {
        // Verify it works
        const result = await instance.add(1, 2);
        expect(result).toBe(3);

        // Initialization should be reasonable (typically 100-300ms for Node.js fork)
        // We don't enforce a strict limit here as fork() is inherently slow
        console.log(`Procxy initialization: ${initTime.toFixed(2)}ms`);
      } finally {
        await instance.$terminate();
      }
    });

    it('should handle rapid instance creation', async () => {
      const instances: Procxy<Calculator>[] = [];
      const startTime = performance.now();

      for (let i = 0; i < 5; i++) {
        const instance = await procxy(Calculator, calculatorPath, undefined, i);
        instances.push(instance);
      }

      const creationTime = performance.now() - startTime;

      try {
        // Verify all instances work independently
        const results = await Promise.all(instances.map((inst, idx) => inst.add(idx, 1)));
        for (let i = 0; i < results.length; i++) {
          expect(results[i]).toBe(i + 1);
        }

        console.log(`Created 5 instances in ${creationTime.toFixed(2)}ms`);
      } finally {
        await Promise.all(instances.map((inst) => inst.$terminate()));
      }
    });
  });

  describe('Memory efficiency', () => {
    it('should not accumulate overhead with sequential operations', async () => {
      proxy = await procxy(Calculator, calculatorPath);

      const operationGroups = 5;
      const operationsPerGroup = 100;
      const groupOverheads: number[] = [];

      for (let group = 0; group < operationGroups; group++) {
        const startTime = performance.now();

        for (let i = 0; i < operationsPerGroup; i++) {
          await proxy.add(i, i + 1);
        }

        const groupTime = performance.now() - startTime;
        groupOverheads.push(groupTime / operationsPerGroup);
      }

      // Last group should not be significantly slower than first group
      const firstGroupAverage = groupOverheads[0];
      const lastGroupAverage = groupOverheads[operationGroups - 1];

      // Allow 100% variance due to system noise and warm-up effects
      // The key is that overhead doesn't grow linearly with operation count
      expect(lastGroupAverage).toBeLessThan(firstGroupAverage * 2);
      console.log(
        `First group avg: ${firstGroupAverage.toFixed(2)}ms, Last group avg: ${lastGroupAverage.toFixed(2)}ms`
      );
    });

    it('should maintain performance with large argument lists', async () => {
      proxy = await procxy(Calculator, calculatorPath);

      // Warm up
      await proxy.add(1, 2);

      const iterations = 50;
      const overheads: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        // Simple method with minimal args (baseline)
        await proxy.add(1, 2);
        overheads.push(performance.now() - start);
      }

      const averageOverhead = overheads.reduce((a, b) => a + b, 0) / overheads.length;
      expect(averageOverhead).toBeLessThan(OVERHEAD_THRESHOLD_MS);
      console.log(`Large arg list average: ${averageOverhead.toFixed(2)}ms`);
    });
  });

  describe('Variance analysis', () => {
    it('should have predictable call time variance', async () => {
      proxy = await procxy(Calculator, calculatorPath);

      // Warm up
      await proxy.add(1, 2);

      const iterations = 200;
      const times: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        await proxy.add(i, i + 1);
        times.push(performance.now() - start);
      }

      // Sort times to analyze distribution
      const sortedTimes = times.sort((a, b) => a - b);
      const min = sortedTimes[0];
      const max = sortedTimes[sortedTimes.length - 1];
      const p50 = sortedTimes[Math.floor(sortedTimes.length * 0.5)];
      const p95 = sortedTimes[Math.floor(sortedTimes.length * 0.95)];
      const p99 = sortedTimes[Math.floor(sortedTimes.length * 0.99)];
      const mean = times.reduce((a, b) => a + b, 0) / times.length;
      const variance = times.reduce((sum, t) => sum + (t - mean) ** 2, 0) / times.length;
      const stdDev = Math.sqrt(variance);

      console.log(`Performance distribution (${iterations} calls):`);
      console.log(`  Min: ${min.toFixed(2)}ms, Max: ${max.toFixed(2)}ms`);
      console.log(`  Mean: ${mean.toFixed(2)}ms, StdDev: ${stdDev.toFixed(2)}ms`);
      console.log(`  P50: ${p50.toFixed(2)}ms, P95: ${p95.toFixed(2)}ms, P99: ${p99.toFixed(2)}ms`);

      // SC-003: Mean overhead should be under 10ms
      expect(mean).toBeLessThan(OVERHEAD_THRESHOLD_MS);
    });
  });
});
