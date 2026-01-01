import { describe, it, expect } from 'vitest';
import { resolve } from 'path';
import { procxy } from '../../src/index.js';
import { AsyncWorker } from '../fixtures/async-worker.js';
import { TimeoutError } from '../../src/shared/errors.js';

// Use absolute paths for module resolution
const ASYNC_WORKER_PATH = resolve(process.cwd(), 'tests/fixtures/async-worker.ts');

describe('Configurable Timeouts', () => {
  describe('timeout behavior', () => {
    it('should timeout when method takes longer than configured timeout', async () => {
      // Create worker with 500ms timeout
      await using worker = await procxy(AsyncWorker, ASYNC_WORKER_PATH, {
        timeout: 500,
        retries: 0 // Disable retries for this test
      });

      // Try to call method that takes 1000ms (exceeds timeout)
      await expect(worker.doWork(1000, 'test')).rejects.toThrow(TimeoutError);
    });

    it('should include method name and timeout duration in TimeoutError', async () => {
      await using worker = await procxy(AsyncWorker, ASYNC_WORKER_PATH, {
        timeout: 300,
        retries: 0
      });
      try {
        await worker.doWork(1000, 'test');
        expect.fail('Should have thrown TimeoutError');
      } catch (error) {
        expect(error).toBeInstanceOf(TimeoutError);
        expect((error as TimeoutError).message).toMatch(/doWork/);
        expect((error as TimeoutError).message).toMatch(/300/);
      }
    });

    it('should use default timeout if not specified', async () => {
      // Default timeout is 30000ms (30 seconds)
      const worker = await procxy(AsyncWorker, ASYNC_WORKER_PATH);
      // Method that takes 100ms should succeed with default timeout
      const result = await worker.doWork(100, 'test');
      expect(result).toBe('Completed: test');
    });
  });

  describe('retry mechanism', () => {
    it('should retry failed calls up to configured retry count', async () => {
      await using worker = await procxy(AsyncWorker, ASYNC_WORKER_PATH, {
        timeout: 200,
        retries: 3 // 1 initial attempt + 3 retries = 4 total attempts
      });
      // Method that takes 300ms will timeout on all attempts
      // Should retry 3 times before giving up
      const start = Date.now();
      await expect(worker.doWork(300, 'test')).rejects.toThrow(TimeoutError);
      const elapsed = Date.now() - start;

      // Should take at least 4 * 200ms = 800ms (4 attempts)
      // Allow some tolerance for timing variations
      expect(elapsed).toBeGreaterThanOrEqual(700);
    });

    it('should succeed if retry succeeds before max retries', async () => {
      await using worker = await procxy(AsyncWorker, ASYNC_WORKER_PATH, {
        timeout: 5000, // Long timeout
        retries: 2
      });
      // Fast method should succeed on first attempt
      const result = await worker.doWork(50, 'success');
      expect(result).toBe('Completed: success');
    });

    it('should use default retry count if not specified', async () => {
      // Default retries is 3
      await using worker = await procxy(AsyncWorker, ASYNC_WORKER_PATH, {
        timeout: 150 // Slightly longer to avoid init timeout
        // No retries specified - should default to 3
      });
      // Should retry with default count (3)
      const start = Date.now();
      await expect(worker.doWork(300, 'test')).rejects.toThrow(TimeoutError);
      const elapsed = Date.now() - start;

      // Should take at least 4 * 150ms = 600ms (1 initial + 3 retries)
      expect(elapsed).toBeGreaterThanOrEqual(550);
    });
  });

  describe('successful calls within timeout', () => {
    it('should succeed when method completes before timeout', async () => {
      await using worker = await procxy(AsyncWorker, ASYNC_WORKER_PATH, {
        timeout: 1000
      });
      // Method that takes 100ms should succeed with 1000ms timeout
      const result = await worker.doWork(100, 'fast');
      expect(result).toBe('Completed: fast');
    });

    it('should handle multiple concurrent calls with timeouts', async () => {
      await using worker = await procxy(AsyncWorker, ASYNC_WORKER_PATH, {
        timeout: 1000
      });
      // Make multiple concurrent calls
      const results = await Promise.all([
        worker.doWork(50, 'fast1'),
        worker.doWork(100, 'fast2'),
        worker.doWork(150, 'fast3')
      ]);

      expect(results).toEqual(['Completed: fast1', 'Completed: fast2', 'Completed: fast3']);
    });

    it('should handle mix of successful and timeout calls', async () => {
      await using worker = await procxy(AsyncWorker, ASYNC_WORKER_PATH, {
        timeout: 200,
        retries: 0
      });
      // Make concurrent calls - some fast, some slow
      const results = await Promise.allSettled([
        worker.doWork(50, 'fast'), // Should succeed
        worker.doWork(500, 'slow1'), // Should timeout
        worker.doWork(100, 'medium'), // Should succeed
        worker.doWork(600, 'slow2') // Should timeout
      ]);

      expect(results[0].status).toBe('fulfilled');
      expect(results[1].status).toBe('rejected');
      expect(results[2].status).toBe('fulfilled');
      expect(results[3].status).toBe('rejected');

      if (results[0].status === 'fulfilled') {
        expect(results[0].value).toBe('Completed: fast');
      }
      if (results[2].status === 'fulfilled') {
        expect(results[2].value).toBe('Completed: medium');
      }
    });
  });
});
