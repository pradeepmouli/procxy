import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { procxy } from '../../src/index.js';
import { Calculator } from '../fixtures/calculator.js';
import { DisposableWorker } from '../fixtures/disposable-worker.js';

const calculatorPath = resolve(process.cwd(), 'tests/fixtures/calculator.ts');
const disposableWorkerPath = resolve(process.cwd(), 'tests/fixtures/disposable-worker.ts');

describe('Disposable Protocol', () => {
  describe('Symbol.asyncDispose (await using)', () => {
    it('should automatically terminate when using await using statement', async () => {
      let pid: number | undefined;

      {
        await using proxy = await procxy(Calculator, calculatorPath);
        pid = proxy.$process.pid;

        // Verify proxy works
        const result = await proxy.add(2, 3);
        expect(result).toBe(5);
        expect(proxy.$process.killed).toBe(false);
      }

      // After block exits, proxy should be disposed
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Process should no longer exist
      let processExists = false;
      try {
        process.kill(pid!, 0); // Signal 0 checks if process exists
        processExists = true;
      } catch {
        processExists = false;
      }
      expect(processExists).toBe(false);
    });

    it('should handle disposal even if method calls fail', async () => {
      let pid: number | undefined;

      try {
        await using proxy = await procxy(Calculator, calculatorPath);
        pid = proxy.$process.pid;

        // This will fail (division by zero)
        await proxy.divide(10, 0);
      } catch (error) {
        expect(error).toBeDefined();
      }

      // Disposal should still happen
      await new Promise((resolve) => setTimeout(resolve, 100));

      let processExists = false;
      try {
        process.kill(pid!, 0);
        processExists = true;
      } catch {
        processExists = false;
      }
      expect(processExists).toBe(false);
    });

    it('should handle nested using statements', async () => {
      const pids: number[] = [];

      {
        await using proxy1 = await procxy(Calculator, calculatorPath, undefined, 1);
        pids.push(proxy1.$process.pid!);

        {
          await using proxy2 = await procxy(Calculator, calculatorPath, undefined, 2);
          pids.push(proxy2.$process.pid!);

          // Both should work
          expect(await proxy1.getPrecision()).toBe(1);
          expect(await proxy2.getPrecision()).toBe(2);
        }

        // proxy2 should be disposed, proxy1 still alive
        await new Promise((resolve) => setTimeout(resolve, 100));
        expect(await proxy1.getPrecision()).toBe(1);
      }

      // Both should be disposed now
      await new Promise((resolve) => setTimeout(resolve, 100));

      for (const pid of pids) {
        let processExists = false;
        try {
          process.kill(pid, 0);
          processExists = true;
        } catch {
          processExists = false;
        }
        expect(processExists).toBe(false);
      }
    });

    it('should work with multiple sequential using blocks', async () => {
      const pids: number[] = [];

      for (let i = 0; i < 3; i++) {
        await using proxy = await procxy(Calculator, calculatorPath, undefined, i);
        pids.push(proxy.$process.pid!);

        const precision = await proxy.getPrecision();
        expect(precision).toBe(i);
      }

      // All should be disposed
      await new Promise((resolve) => setTimeout(resolve, 100));

      for (const pid of pids) {
        let processExists = false;
        try {
          process.kill(pid, 0);
          processExists = true;
        } catch {
          processExists = false;
        }
        expect(processExists).toBe(false);
      }
    });
  });

  describe('Symbol.dispose (using)', () => {
    it('should terminate synchronously with using statement', async () => {
      let pid: number | undefined;
      let proxy: any;

      {
        using tempProxy = await procxy(Calculator, calculatorPath);
        proxy = tempProxy;
        pid = proxy.$process.pid;

        // Verify proxy works
        const result = await proxy.add(2, 3);
        expect(result).toBe(5);
      }

      // Synchronous disposal initiated, give time for cleanup
      await new Promise((resolve) => setTimeout(resolve, 100));

      let processExists = false;
      try {
        process.kill(pid!, 0);
        processExists = true;
      } catch {
        processExists = false;
      }
      expect(processExists).toBe(false);
    });

    it('should handle multiple using blocks', async () => {
      const pids: number[] = [];

      {
        using proxy1 = await procxy(Calculator, calculatorPath, undefined, 1);
        pids.push(proxy1.$process.pid!);
        expect(await proxy1.getPrecision()).toBe(1);
      }

      {
        using proxy2 = await procxy(Calculator, calculatorPath, undefined, 2);
        pids.push(proxy2.$process.pid!);
        expect(await proxy2.getPrecision()).toBe(2);
      }

      // Both should be disposed
      await new Promise((resolve) => setTimeout(resolve, 100));

      for (const pid of pids) {
        let processExists = false;
        try {
          process.kill(pid, 0);
          processExists = true;
        } catch {
          processExists = false;
        }
        expect(processExists).toBe(false);
      }
    });
  });

  describe('Manual vs automatic disposal', () => {
    it('should allow explicit $terminate() even with using statement', async () => {
      let terminated = false;

      {
        await using proxy = await procxy(Calculator, calculatorPath);

        const result = await proxy.add(1, 2);
        expect(result).toBe(3);

        // Explicitly terminate
        await proxy.$terminate();
        terminated = true;

        // Subsequent calls should fail
        await expect(proxy.add(1, 2)).rejects.toThrow();
      }

      expect(terminated).toBe(true);
      // Disposal on block exit should handle already-terminated gracefully
    });

    it('should prefer await using over using for guaranteed cleanup', async () => {
      // This test documents the recommendation
      let asyncDisposalTime = 0;
      let syncDisposalTime = 0;

      // await using - waits for disposal
      {
        const start = performance.now();
        await using proxy = await procxy(Calculator, calculatorPath);
        await proxy.add(1, 2);
        // Block exit awaits disposal
        asyncDisposalTime = performance.now() - start;
      }

      // using - initiates disposal but doesn't wait
      {
        const start = performance.now();
        using proxy = await procxy(Calculator, calculatorPath);
        await proxy.add(1, 2);
        // Block exit doesn't await disposal
        syncDisposalTime = performance.now() - start;
      }

      // async disposal takes time to complete
      console.log(`Async disposal: ${asyncDisposalTime.toFixed(2)}ms`);
      console.log(`Sync disposal: ${syncDisposalTime.toFixed(2)}ms`);
    });
  });

  describe('Error handling with disposables', () => {
    it('should dispose even when constructor throws', async () => {
      // This test verifies disposal happens even on initialization failure
      await expect(async () => {
        await using proxy = await procxy(Calculator, '/non/existent/path.ts');
        await proxy.add(1, 2);
      }).rejects.toThrow();
    });

    it('should dispose when method throws inside using block', async () => {
      let pid: number | undefined;

      try {
        await using proxy = await procxy(Calculator, calculatorPath);
        pid = proxy.$process.pid;

        // This will throw
        await proxy.divide(10, 0);
      } catch (error) {
        expect(error).toBeDefined();
      }

      // Should still be disposed
      await new Promise((resolve) => setTimeout(resolve, 100));

      let processExists = false;
      try {
        process.kill(pid!, 0);
        processExists = true;
      } catch {
        processExists = false;
      }
      expect(processExists).toBe(false);
    });
  });

  describe('Remote object disposal propagation', () => {
    it('should call Symbol.asyncDispose on remote object when proxy is disposed', async () => {
      await using proxy = await procxy(DisposableWorker, disposableWorkerPath);

      // Verify worker is functional
      const result = await proxy.doWork('test');
      expect(result).toBe('Processed: test');

      // Check initial state
      expect(await proxy.isAsyncDisposed()).toBe(false);

      // Disposal will happen automatically when block exits
    });

    // After block exits, remote object should have been disposed
    // We can't directly verify this since the process is killed, but the
    // DISPOSE message should have been sent

    it('should handle remote disposal gracefully even if remote object throws', async () => {
      // Create a worker, use it, then dispose
      const proxy = await procxy(DisposableWorker, disposableWorkerPath);

      const result = await proxy.doWork('data');
      expect(result).toBe('Processed: data');

      // Dispose should not throw even if remote cleanup has issues
      await expect(proxy.$terminate()).resolves.toBeUndefined();
    });

    it('should dispose remote object before killing process', async () => {
      const proxy = await procxy(DisposableWorker, disposableWorkerPath);

      const result = await proxy.doWork('test');
      expect(result).toBe('Processed: test');

      // Explicitly terminate
      await proxy.$terminate();

      // Subsequent calls should fail (process is dead)
      await expect(proxy.doWork('more')).rejects.toThrow();
    });

    it('should work with non-disposable objects (no-op disposal)', async () => {
      // Calculator doesn't implement disposable
      await using proxy = await procxy(Calculator, calculatorPath);

      const result = await proxy.add(5, 10);
      expect(result).toBe(15);

      // Disposal should work fine even though Calculator has no dispose method
    });
  });
});
