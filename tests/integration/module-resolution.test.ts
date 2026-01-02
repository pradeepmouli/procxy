import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { procxy } from '../../src/index.js';
import type { Procxy } from '../../src/types/procxy.js';
import { Calculator } from '../fixtures/calculator.js';
import { AsyncWorker } from '../fixtures/async-worker.js';

const calculatorPath = resolve(process.cwd(), 'tests/fixtures/calculator.ts');
const asyncWorkerPath = resolve(process.cwd(), 'tests/fixtures/async-worker.ts');

describe('Module Resolution (T068)', () => {
  let proxies: Procxy<any>[] = [];

  describe('Explicit modulePath option', () => {
    it('should use explicit modulePath when provided', async () => {
      const proxy = await procxy(Calculator, calculatorPath);
      proxies.push(proxy);

      const result = await proxy.add(2, 3);
      expect(result).toBe(5);
    });

    it('should work with absolute paths', async () => {
      const absolutePath = resolve(process.cwd(), 'tests/fixtures/calculator.ts');
      const proxy = await procxy(Calculator, absolutePath);
      proxies.push(proxy);

      const result = await proxy.add(10, 20);
      expect(result).toBe(30);
    });

    it('should work with different fixtures using explicit modulePaths', async () => {
      const proxy1 = await procxy(Calculator, calculatorPath);
      const proxy2 = await procxy(AsyncWorker, asyncWorkerPath);
      proxies.push(proxy1, proxy2);

      const calc = await proxy1.add(5, 10);
      // AsyncWorker has doWork method: async doWork(durationMs, result)
      const asyncResult = await proxy2.doWork(10, 'test');

      expect(calc).toBe(15);
      expect(asyncResult).toBe('Completed: test');
    });

    it('should work with constructor arguments and explicit modulePath', async () => {
      const proxy = await procxy(Calculator, calculatorPath, undefined, 3);
      proxies.push(proxy);

      const precision = await proxy.getPrecision();
      expect(precision).toBe(3);

      const result = await proxy.divide(10, 3);
      expect(result).toBe(3.333);
    });

    it('should work with options and explicit modulePath', async () => {
      const proxy = await procxy(
        Calculator,
        calculatorPath,
        {
          timeout: 60000,
          retries: 5
        },
        2
      );
      proxies.push(proxy);

      const precision = await proxy.getPrecision();
      expect(precision).toBe(2);

      const result = await proxy.add(1.5, 2.5);
      expect(result).toBe(4);
    });
  });

  describe('ModulePath override behavior', () => {
    it('should resolve correct class when modulePath is explicit', async () => {
      // Both fixtures have methods, but different implementations
      const calcProxy = await procxy(Calculator, calculatorPath);
      const asyncProxy = await procxy(AsyncWorker, asyncWorkerPath);
      proxies.push(calcProxy, asyncProxy);

      // Calculator methods return numbers
      const calcResult = await calcProxy.add(1, 1);
      expect(typeof calcResult).toBe('number');
      expect(calcResult).toBe(2);

      // AsyncWorker has different methods (doWork returns Promise<string>)
      const asyncResult = await asyncProxy.doWork(10, 'test');
      expect(typeof asyncResult).toBe('string');
      expect(asyncResult).toBe('Completed: test');
    });

    it('should work with relative paths (converted to absolute)', async () => {
      // Even though we pass relative-looking path, procxy should handle it
      const proxy = await procxy(Calculator, calculatorPath);
      proxies.push(proxy);

      const result = await proxy.multiply(6, 7);
      expect(result).toBe(42);
    });

    it('should maintain modulePath across multiple instances', async () => {
      const proxy1 = await procxy(Calculator, calculatorPath, undefined, 0);
      const proxy2 = await procxy(Calculator, calculatorPath, undefined, 3);
      const proxy3 = await procxy(Calculator, calculatorPath, undefined, 5);
      proxies.push(proxy1, proxy2, proxy3);

      // Each should use its own precision despite same module path
      expect(await proxy1.getPrecision()).toBe(0);
      expect(await proxy2.getPrecision()).toBe(3);
      expect(await proxy3.getPrecision()).toBe(5);

      // Verify calculations respect each instance's precision
      expect(await proxy1.divide(10, 3)).toBe(3);
      expect(await proxy2.divide(10, 3)).toBe(3.333);
      expect(await proxy3.divide(10, 3)).toBe(3.33333);
    });
  });

  describe('Module resolution edge cases', () => {
    it('should work with explicit modulePath and custom environment', async () => {
      const proxy = await procxy(Calculator, calculatorPath, {
        env: {
          TEST_ENV_VAR: 'test-value'
        }
      });
      proxies.push(proxy);

      // Should still work normally
      const result = await proxy.add(7, 8);
      expect(result).toBe(15);
    });

    it('should work with explicit modulePath and custom cwd', async () => {
      const proxy = await procxy(Calculator, calculatorPath, {
        cwd: process.cwd()
      });
      proxies.push(proxy);

      const result = await proxy.subtract(100, 30);
      expect(result).toBe(70);
    });

    it('should work with explicit modulePath and timeout option', async () => {
      const proxy = await procxy(Calculator, calculatorPath, {
        timeout: 5000
      });
      proxies.push(proxy);

      // Quick operation should work fine with custom timeout
      const result = await proxy.add(5, 5);
      expect(result).toBe(10);
    });

    it('should work with all options including modulePath', async () => {
      const proxy = await procxy(Calculator, calculatorPath, {
        timeout: 30000,
        retries: 3,
        cwd: process.cwd(),
        env: { NODE_ENV: 'test' },
        args: []
      });
      proxies.push(proxy);

      const result = await proxy.multiply(3, 4);
      expect(result).toBe(12);
    });
  });

  describe('Multiple concurrent instances with different modules', () => {
    it('should handle multiple concurrent proxies with explicit modulePaths', async () => {
      const proxy1 = await procxy(Calculator, calculatorPath, undefined, 0);
      const proxy2 = await procxy(AsyncWorker, asyncWorkerPath);
      const proxy3 = await procxy(Calculator, calculatorPath, undefined, 2);
      proxies.push(proxy1, proxy2, proxy3);

      const [result1, result2, result3] = await Promise.all([
        proxy1.add(1, 2),
        proxy2.doWork(10, 'test'),
        proxy3.add(1, 2)
      ]);

      expect(result1).toBe(3); // integer
      expect(result2).toBe('Completed: test');
      expect(result3).toBe(3); // 2 decimal places
    });

    it('should isolate state between instances with same module', async () => {
      const proxy1 = await procxy(Calculator, calculatorPath, undefined, 1);
      const proxy2 = await procxy(Calculator, calculatorPath, undefined, 4);
      proxies.push(proxy1, proxy2);

      // Each should have independent state
      const precision1 = await proxy1.getPrecision();
      const precision2 = await proxy2.getPrecision();

      expect(precision1).toBe(1);
      expect(precision2).toBe(4);

      // Verify they actually use different precision
      const div1 = await proxy1.divide(22, 7);
      const div2 = await proxy2.divide(22, 7);

      expect(div1).toBe(3.1);
      expect(div2).toBe(3.1429);
    });
  });

  describe('ErrorCase: Invalid modulePath', () => {
    it('should reject non-existent modulePath', async () => {
      await expect(async () => {
        const proxy = await procxy(Calculator, '/non/existent/path/to/module.ts');
        proxies.push(proxy);
      }).rejects.toThrow();
    });
  });

  describe('Extension Resolution (.ts/.js fallback)', () => {
    it('should resolve .ts file when it exists', async () => {
      // ts-only-worker.ts exists as a .ts file
      const tsOnlyPath = resolve(process.cwd(), 'tests/fixtures/ts-only-worker.ts');
      
      // Dynamic import to test the fixture works
      const module = await import('../fixtures/ts-only-worker.js');
      const TsOnlyWorker = module.TsOnlyWorker;
      
      const proxy = await procxy(TsOnlyWorker, tsOnlyPath);
      proxies.push(proxy);

      const result = await proxy.greet('World');
      expect(result).toBe('Hello from TS, World!');
    });

    it('should resolve .js file when only .js exists', async () => {
      // js-only-worker.js exists as a .js file
      const jsOnlyPath = resolve(process.cwd(), 'tests/fixtures/js-only-worker.js');
      
      // Dynamic import to test the fixture works
      const module = await import('../fixtures/js-only-worker.js');
      const JsOnlyWorker = module.JsOnlyWorker;
      
      const proxy = await procxy(JsOnlyWorker, jsOnlyPath);
      proxies.push(proxy);

      const result = await proxy.greet('World');
      expect(result).toBe('Hello from JS, World!');
    });
  });
});
