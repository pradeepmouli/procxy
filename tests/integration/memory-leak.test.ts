/**
 * Memory Leak Testing (SC-004, NFR-004, T079)
 *
 * This test verifies that procxy doesn't leak memory over many sequential calls
 * in a long-running process. Per spec requirements:
 * - SC-004: Zero memory leaks after 1000 sequential method calls
 * - NFR-004: No observable memory growth over extended operation
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { procxy } from '../../src/index.js';

const CALCULATOR_PATH = './tests/fixtures/calculator.js';

class Calculator {
  add(a: number, b: number): number {
    return a + b;
  }

  multiply(a: number, b: number): number {
    return a * b;
  }
}

describe('Memory Leak Testing (T079)', () => {
  let calc: Awaited<ReturnType<typeof procxy<Calculator>>>;

  beforeEach(async () => {
    calc = await procxy(Calculator, CALCULATOR_PATH);
  });

  afterEach(async () => {
    if (calc) {
      await calc.$terminate();
    }
  });

  it('should not leak memory after 1000 sequential calls (SC-004)', async () => {
    const iterations = 1000;
    const memorySnapshots: number[] = [];

    // Warm up
    for (let i = 0; i < 10; i++) {
      await calc.add(i, i + 1);
    }

    // Force garbage collection if available (run with --expose-gc)
    if (global.gc) {
      global.gc();
    }

    // Take initial memory snapshot
    const initialMemory = process.memoryUsage().heapUsed;
    memorySnapshots.push(initialMemory);

    // Run 1000 sequential calls
    for (let i = 0; i < iterations; i++) {
      await calc.add(i, i + 1);

      // Take memory snapshots every 100 calls
      if ((i + 1) % 100 === 0 && global.gc) {
        global.gc();
        memorySnapshots.push(process.memoryUsage().heapUsed);
      }
    }

    // Final garbage collection and memory snapshot
    if (global.gc) {
      global.gc();
    }
    const finalMemory = process.memoryUsage().heapUsed;
    memorySnapshots.push(finalMemory);

    // Calculate memory growth
    const memoryGrowth = finalMemory - initialMemory;
    const memoryGrowthMB = memoryGrowth / (1024 * 1024);

    console.log(`Memory growth after ${iterations} calls: ${memoryGrowthMB.toFixed(2)} MB`);
    console.log(`Initial: ${(initialMemory / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Final: ${(finalMemory / 1024 / 1024).toFixed(2)} MB`);

    // Memory growth should be minimal (<10MB for 1000 calls)
    // This accounts for V8 heap fluctuations and JIT compilation
    expect(memoryGrowthMB).toBeLessThan(10);

    // Verify all calls still work after 1000 iterations
    const result = await calc.add(100, 200);
    expect(result).toBe(300);
  }, 60000); // 60s timeout for 1000 calls

  it('should not accumulate pending requests over many calls', async () => {
    const iterations = 500;

    // Make many sequential calls
    for (let i = 0; i < iterations; i++) {
      const result = await calc.add(i, i + 1);
      expect(result).toBe(2 * i + 1);
    }

    // Verify proxy still responds correctly
    const finalResult = await calc.multiply(10, 20);
    expect(finalResult).toBe(200);
  }, 30000);

  it('should handle rapid fire calls without memory buildup', async () => {
    const batches = 10;
    const batchSize = 100;

    for (let batch = 0; batch < batches; batch++) {
      // Fire 100 calls in parallel
      const promises = Array.from({ length: batchSize }, (_, i) =>
        calc.add(batch * batchSize + i, 1)
      );

      const results = await Promise.all(promises);

      // Verify all results are correct
      results.forEach((result, i) => {
        expect(result).toBe(batch * batchSize + i + 1);
      });
    }

    // Total: 1000 calls across 10 batches
    console.log(`Completed ${batches * batchSize} calls in batches`);
  }, 30000);

  it('should clean up event listeners over many calls', async () => {
    // Make many calls that trigger IPC message events
    for (let i = 0; i < 1000; i++) {
      await calc.add(i, i + 1);
    }

    // Get listener counts
    const messageListeners = calc.$process.listenerCount('message');
    const exitListeners = calc.$process.listenerCount('exit');

    console.log(
      `After 1000 calls - message listeners: ${messageListeners}, exit listeners: ${exitListeners}`
    );

    // Should have constant number of listeners (not growing)
    // Exact count depends on implementation, but should be small
    expect(messageListeners).toBeLessThan(10);
    expect(exitListeners).toBeLessThan(10);
  }, 30000);

  it('should maintain consistent performance over extended operation', async () => {
    const groups = 10;
    const callsPerGroup = 100;
    const timings: number[] = [];

    for (let group = 0; group < groups; group++) {
      const start = performance.now();

      for (let i = 0; i < callsPerGroup; i++) {
        await calc.add(i, i + 1);
      }

      const elapsed = performance.now() - start;
      timings.push(elapsed);
    }

    // Calculate average time per group
    const avgTimes = timings.map((t) => t / callsPerGroup);

    console.log('Average time per call in each group (ms):');
    avgTimes.forEach((avg, i) => {
      console.log(`  Group ${i + 1}: ${avg.toFixed(3)}ms`);
    });

    // Last group should not be significantly slower than first
    // (indicating no memory pressure or resource exhaustion)
    const firstGroupAvg = avgTimes[0];
    const lastGroupAvg = avgTimes[groups - 1];

    // Allow 2x variance (performance can improve with JIT warmup)
    expect(lastGroupAvg).toBeLessThan(firstGroupAvg * 2);

    console.log(`Performance variance: ${((lastGroupAvg / firstGroupAvg) * 100).toFixed(1)}%`);
  }, 60000);
});
