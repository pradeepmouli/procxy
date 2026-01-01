import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { procxy } from '../../src/index.js';
import { Calculator } from '../fixtures/calculator.js';

const calculatorPath = resolve(process.cwd(), 'tests/fixtures/calculator.ts');

describe('Basic Method Invocation (US1)', () => {
  it('invokes basic arithmetic methods', async () => {
    await using proxy = await procxy(Calculator, calculatorPath);

    expect(await proxy.add(5, 7)).toBe(12);
    expect(await proxy.subtract(10, 3)).toBe(7);
    expect(await proxy.multiply(4, 5)).toBe(20);
  });

  it('handles division and propagates errors', async () => {
    await using proxy = await procxy(Calculator, calculatorPath);

    expect(await proxy.divide(10, 2)).toBe(5);
    await expect(proxy.divide(10, 0)).rejects.toThrow('Division by zero');
  });

  it('supports concurrent method calls', async () => {
    await using proxy = await procxy(Calculator, calculatorPath);

    const results = await Promise.all([
      proxy.add(1, 2),
      proxy.multiply(3, 4),
      proxy.subtract(10, 5),
      proxy.divide(20, 4)
    ]);

    expect(results).toEqual([3, 12, 5, 5]);
  });

  it('respects constructor arguments', async () => {
    await using proxy = await procxy(Calculator, calculatorPath, undefined, 4);
    expect(await proxy.getPrecision()).toBe(4);
  });

  it('exposes lifecycle helpers', async () => {
    await using proxy = await procxy(Calculator, calculatorPath);
    expect(typeof proxy.$terminate).toBe('function');
    expect(proxy.$process.pid).toBeTypeOf('number');
  });
});
