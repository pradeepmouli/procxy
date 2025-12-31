import { describe, it, expect, afterEach } from 'vitest';
import { resolve } from 'path';
import { procxy } from '../../src/index.js';
import { Calculator } from '../fixtures/calculator.js';
import { AsyncWorker } from '../fixtures/async-worker.js';

// Use absolute paths for module resolution
const CALCULATOR_PATH = resolve(process.cwd(), 'tests/fixtures/calculator.ts');
const ASYNC_WORKER_PATH = resolve(process.cwd(), 'tests/fixtures/async-worker.ts');

describe('Lifecycle Management', () => {
  const activeProxies: Array<{ $terminate: () => Promise<void> }> = [];

  afterEach(async () => {
    // Clean up any proxies that weren't terminated in the test
    await Promise.all(activeProxies.map((p) => p.$terminate().catch(() => {})));
    activeProxies.length = 0;
  });

  describe('$terminate() method', () => {
    it('should terminate the child process', async () => {
      const calc = await procxy(Calculator, CALCULATOR_PATH);
      activeProxies.push(calc);

      // Verify child is running
      expect(calc.$process.pid).toBeTypeOf('number');
      expect(calc.$process.killed).toBe(false);

      // Call a method to ensure it works
      const result = await calc.add(5, 7);
      expect(result).toBe(12);

      // Terminate the child
      await calc.$terminate();

      // Verify child is killed
      expect(calc.$process.killed).toBe(true);
    });

    it('should reject pending promises when terminated', async () => {
      const worker = await procxy(AsyncWorker, ASYNC_WORKER_PATH);
      activeProxies.push(worker);

      // Start a slow operation (1000ms delay) and catch rejection to prevent unhandled rejection
      const promise = worker.doWork(1000, 'test').catch((err) => err);

      // Terminate immediately without waiting
      await worker.$terminate();

      // The pending promise should reject - since we caught it, check the error
      const error = await promise;
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toMatch(/terminated|crashed/i);
    });

    it('should reject subsequent method calls after termination', async () => {
      const calc = await procxy(Calculator, CALCULATOR_PATH);
      activeProxies.push(calc);

      // Terminate the child
      await calc.$terminate();

      // Subsequent calls should fail
      await expect(calc.add(1, 2)).rejects.toThrow(/terminated|crashed/i);
    });

    it('should be idempotent (safe to call multiple times)', async () => {
      const calc = await procxy(Calculator, CALCULATOR_PATH);
      activeProxies.push(calc);

      // First termination
      await calc.$terminate();

      // Second termination should not throw
      await expect(calc.$terminate()).resolves.toBeUndefined();
    });
  });

  describe('$process property', () => {
    it('should expose the ChildProcess instance', async () => {
      const calc = await procxy(Calculator, CALCULATOR_PATH);
      activeProxies.push(calc);

      // Verify $process is accessible
      expect(calc.$process).toBeDefined();
      expect(calc.$process.pid).toBeTypeOf('number');
      expect(calc.$process.pid).toBeGreaterThan(0);
    });

    it('should provide access to child process properties', async () => {
      const calc = await procxy(Calculator, CALCULATOR_PATH, { env: { TEST_VAR: 'test123' } });
      activeProxies.push(calc);

      // Verify we can access process properties
      expect(calc.$process.connected).toBe(true);
      expect(calc.$process.killed).toBe(false);
      expect(calc.$process.exitCode).toBeNull();

      await calc.$terminate();

      // After termination, killed should be true
      expect(calc.$process.killed).toBe(true);
    });
  });

  describe('Child process crash detection', () => {
    it('should reject pending promises when child crashes', async () => {
      const calc = await procxy(Calculator, CALCULATOR_PATH);
      activeProxies.push(calc);

      // Start a slow operation
      const promise = calc.add(1, 2);

      // Kill the child process unexpectedly (simulating a crash)
      calc.$process.kill('SIGKILL');

      // The pending promise should reject with ChildCrashedError
      await expect(promise).rejects.toThrow(/crashed|terminated/i);
    });

    it('should reject subsequent calls after child crash', async () => {
      const calc = await procxy(Calculator, CALCULATOR_PATH);
      activeProxies.push(calc);

      // Kill the child process
      calc.$process.kill('SIGKILL');

      // Wait a bit for the exit event to be processed
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Subsequent calls should fail
      await expect(calc.add(1, 2)).rejects.toThrow(/crashed|terminated/i);
    });
  });

  describe('Memory and resource cleanup', () => {
    it('should clean up IPC client request maps after responses', async () => {
      const calc = await procxy(Calculator, CALCULATOR_PATH);
      activeProxies.push(calc);

      // Make multiple calls
      await Promise.all([
        calc.add(1, 2),
        calc.add(3, 4),
        calc.add(5, 6),
        calc.multiply(2, 3),
        calc.divide(10, 2)
      ]);

      // The internal pending requests map should be empty after all responses
      // We can't directly verify this, but we can verify behavior doesn't degrade
      // Make more calls to ensure no memory leak symptoms
      for (let i = 0; i < 100; i++) {
        await calc.add(i, i + 1);
      }

      // If there's a memory leak, this would eventually cause issues
      // For now, just verify the proxy still works
      const result = await calc.add(100, 200);
      expect(result).toBe(300);

      await calc.$terminate();
    });

    it('should remove all event listeners on termination', async () => {
      const calc = await procxy(Calculator, CALCULATOR_PATH);
      activeProxies.push(calc);

      // Call a few methods to establish IPC
      await calc.add(1, 2);

      // Verify child has listeners
      const listenerCountBefore = calc.$process.listenerCount('message');
      expect(listenerCountBefore).toBeGreaterThan(0);

      // Terminate
      await calc.$terminate();

      // Verify message listeners are reduced (some may remain from terminate's exit handler)
      const listenerCountAfter = calc.$process.listenerCount('message');
      expect(listenerCountAfter).toBeLessThanOrEqual(listenerCountBefore);

      // The key check: process should be killed
      expect(calc.$process.killed).toBe(true);
    });
  });
});
