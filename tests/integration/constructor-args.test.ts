import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { procxy } from '../../src/index.js';
import type { Procxy } from '../../src/types/procxy.js';
import { Calculator } from '../fixtures/calculator.js';
import { SerializationError } from '../../src/shared/errors.js';

const calculatorPath = resolve(process.cwd(), 'tests/fixtures/calculator.ts');

describe('Constructor Arguments (T069)', () => {
  let proxy: Procxy<Calculator> | null = null;

  describe('Basic constructor arguments', () => {
    it('should pass no arguments to constructor', async () => {
      proxy = await procxy(Calculator, calculatorPath);

      const precision = await proxy.getPrecision();
      expect(precision).toBe(2); // default value
    });

    it('should pass single argument to constructor', async () => {
      proxy = await procxy(Calculator, calculatorPath, undefined, 4);

      const precision = await proxy.getPrecision();
      expect(precision).toBe(4);
    });

    it('should pass multiple precision values', async () => {
      proxy = await procxy(Calculator, calculatorPath, undefined, 3);

      const precision = await proxy.getPrecision();
      expect(precision).toBe(3);
    });
  });

  describe('Constructor argument types', () => {
    it('should pass number arguments', async () => {
      proxy = await procxy(Calculator, calculatorPath, undefined, 5);
      expect(await proxy.getPrecision()).toBe(5);
    });

    it('should pass zero as constructor argument', async () => {
      proxy = await procxy(Calculator, calculatorPath, undefined, 0);

      const precision = await proxy.getPrecision();
      expect(precision).toBe(0);

      const result = await proxy.add(1.9, 2.8);
      expect(result).toBe(5); // rounded to integer
    });

    it('should pass negative numbers as constructor arguments', async () => {
      // Even though precision should be positive, test negative is passed
      proxy = await procxy(Calculator, calculatorPath, undefined, -1);

      const precision = await proxy.getPrecision();
      expect(precision).toBe(-1);
    });
  });

  describe('Different precisions', () => {
    it('should create calculator with precision 0', async () => {
      proxy = await procxy(Calculator, calculatorPath, undefined, 0);

      const result = await proxy.add(1.5, 2.7);
      expect(result).toBe(4); // rounded to integer
    });

    it('should create calculator with precision 1', async () => {
      proxy = await procxy(Calculator, calculatorPath, undefined, 1);

      const result = await proxy.add(1.55, 2.77);
      expect(result).toBe(4.3); // one decimal place
    });

    it('should create calculator with precision 3', async () => {
      proxy = await procxy(Calculator, calculatorPath, undefined, 3);

      const result = await proxy.divide(10, 3);
      expect(result).toBe(3.333);
    });

    it('should create calculator with precision 5', async () => {
      proxy = await procxy(Calculator, calculatorPath, undefined, 5);

      const result = await proxy.divide(1, 3);
      expect(result).toBe(0.33333);
    });
  });

  describe('Constructor argument validation', () => {
    it('should reject functions as constructor arguments', async () => {
      const fn = () => {};

      // Functions are not JSON-serializable and should be rejected
      // (unless passed in a context where callbacks are supported)
      await expect(async () => {
        proxy = await procxy(Calculator, calculatorPath, undefined, fn as any);
      }).rejects.toThrow(SerializationError);
    });

    it('should handle symbols as constructor arguments (converted to undefined by JSON)', async () => {
      const sym = Symbol('test');

      // JSON.stringify converts symbols to undefined
      // undefined becomes null when deserialized, so Calculator gets null as precision
      proxy = await procxy(Calculator, calculatorPath, undefined, sym as any);

      // Symbol -> undefined (JSON) -> null (IPC), so precision = null
      const precision = await proxy.getPrecision();
      expect(precision).toBe(null);
    });

    it('should reject arguments with circular references', async () => {
      const circular: any = { a: 1 };
      circular.self = circular;

      await expect(async () => {
        proxy = await procxy(Calculator, calculatorPath, undefined, circular);
      }).rejects.toThrow();
    });
  });

  describe('Multiple instances with different constructor args', () => {
    it('should handle multiple instances with different precision values', async () => {
      const proxy1 = await procxy(Calculator, calculatorPath, undefined, 1);
      const proxy2 = await procxy(Calculator, calculatorPath, undefined, 3);
      const proxy3 = await procxy(Calculator, calculatorPath, undefined, 5);

      try {
        const result1 = await proxy1.divide(10, 3);
        const result2 = await proxy2.divide(10, 3);
        const result3 = await proxy3.divide(10, 3);

        expect(result1).toBe(3.3);
        expect(result2).toBe(3.333);
        expect(result3).toBe(3.33333);

        expect(await proxy1.getPrecision()).toBe(1);
        expect(await proxy2.getPrecision()).toBe(3);
        expect(await proxy3.getPrecision()).toBe(5);
      } finally {
        await proxy1.$terminate();
        await proxy2.$terminate();
        await proxy3.$terminate();
      }
    });

    it('should isolate constructor arguments between instances', async () => {
      const proxy1 = await procxy(Calculator, calculatorPath, undefined, 2);
      const proxy2 = await procxy(Calculator, calculatorPath, undefined, 4);

      try {
        // Each instance should have its own precision
        expect(await proxy1.getPrecision()).toBe(2);
        expect(await proxy2.getPrecision()).toBe(4);

        // Verify they calculate differently
        const result1 = await proxy1.add(1.111, 2.222);
        const result2 = await proxy2.add(1.111, 2.222);

        expect(result1).toBe(3.33); // precision 2
        expect(result2).toBe(3.333); // precision 4
      } finally {
        await proxy1.$terminate();
        await proxy2.$terminate();
      }
    });
  });

  describe('Edge cases', () => {
    it('should handle large precision values', async () => {
      proxy = await procxy(Calculator, calculatorPath, undefined, 10);

      const precision = await proxy.getPrecision();
      expect(precision).toBe(10);

      const result = await proxy.divide(1, 3);
      expect(result).toBeCloseTo(0.3333333333, 10);
    });

    it('should handle sequential proxy creation with different args', async () => {
      // Create and destroy multiple proxies in sequence
      for (let i = 0; i < 5; i++) {
        proxy = await procxy(Calculator, calculatorPath, undefined, i);
        expect(await proxy.getPrecision()).toBe(i);
        proxy = null;
      }
    });
  });

  describe('Constructor args with methods', () => {
    it('should respect constructor precision in all operations', async () => {
      proxy = await procxy(Calculator, calculatorPath, undefined, 2);

      expect(await proxy.add(1.111, 2.222)).toBe(3.33);
      expect(await proxy.subtract(5.555, 2.222)).toBe(3.33);
      expect(await proxy.multiply(1.111, 2.222)).toBe(2.47);
      expect(await proxy.divide(10, 3)).toBe(3.33);
    });

    it('should handle precision 0 for integer calculations', async () => {
      proxy = await procxy(Calculator, calculatorPath, undefined, 0);

      expect(await proxy.add(1.9, 2.1)).toBe(4);
      expect(await proxy.subtract(10.7, 5.3)).toBe(5);
      expect(await proxy.multiply(2.4, 2.6)).toBe(6);
      expect(await proxy.divide(10, 3)).toBe(3);
    });
  });
});
