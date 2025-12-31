import { describe, it, expect } from 'vitest';
import { procxy } from '../../src';
import { Calculator } from '../fixtures/calculator.js';

describe('Automatic Module Path Detection', () => {
  it('should automatically detect module path from import statement', async () => {
    // No explicit modulePath needed - should be auto-detected from the import above
    const proxy = await procxy(Calculator);

    try {
      const result = await proxy.add(10, 20);
      expect(result).toBe(30);

      const result2 = await proxy.multiply(5, 6);
      expect(result2).toBe(30);
    } finally {
      await proxy.$terminate();
    }
  });

  it('should work with multiple instances using auto-detection', async () => {
    const proxy1 = await procxy(Calculator);
    const proxy2 = await procxy(Calculator);

    try {
      const [result1, result2] = await Promise.all([proxy1.add(1, 2), proxy2.add(3, 4)]);

      expect(result1).toBe(3);
      expect(result2).toBe(7);
    } finally {
      await Promise.all([proxy1.$terminate(), proxy2.$terminate()]);
    }
  });

  it('should allow explicit modulePath to override auto-detection', async () => {
    const { resolve } = await import('node:path');
    const calculatorPath = resolve(process.cwd(), 'tests/fixtures/calculator.ts');

    // Explicit path should still work
    const proxy = await procxy(Calculator, calculatorPath);

    try {
      const result = await proxy.add(100, 200);
      expect(result).toBe(300);
    } finally {
      await proxy.$terminate();
    }
  });

  it('should handle async methods with auto-detection', async () => {
    const { AsyncWorker } = await import('../fixtures/async-worker.js');
    const { resolve } = await import('node:path');
    const asyncWorkerPath = resolve(process.cwd(), 'tests/fixtures/async-worker.ts');

    // Dynamic imports can't be detected from source - need explicit path
    const proxy = await procxy(AsyncWorker, asyncWorkerPath);

    try {
      const result = await proxy.doWork(10, 'test');
      expect(result).toBe('Completed: test');
    } finally {
      await proxy.$terminate();
    }
  });
});
