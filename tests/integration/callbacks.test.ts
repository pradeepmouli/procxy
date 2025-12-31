import { resolve } from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { procxy } from '../../src/index.js';
import type { Procxy } from '../../src/types/procxy.js';
import { CallbackWorker } from '../fixtures/callback-worker.js';

const callbackWorkerPath = resolve(process.cwd(), 'tests/fixtures/callback-worker.ts');

describe('Callbacks', () => {
  let proxy: Procxy<CallbackWorker>;

  beforeEach(async () => {
    proxy = await procxy(CallbackWorker, callbackWorkerPath);
  });

  afterEach(async () => {
    if (proxy) {
      await proxy.$terminate();
    }
  });

  it('should invoke callback immediately', async () => {
    const values: number[] = [];

    await proxy.invoke((value) => {
      values.push(value);
    }, 42);

    expect(values).toEqual([42]);
  });

  it('should invoke async callback', async () => {
    const values: number[] = [];

    await proxy.invokeAsync(async (value) => {
      values.push(value);
    }, 100);

    expect(values).toEqual([100]);
  });

  it('should invoke callback multiple times', async () => {
    const values: number[] = [];

    await proxy.invokeMultiple((value) => {
      values.push(value);
    }, 5);

    expect(values).toEqual([0, 1, 2, 3, 4]);
  });

  it('should handle callback with multiple parameters', async () => {
    let capturedA: number | undefined;
    let capturedB: string | undefined;
    let capturedC: boolean | undefined;

    await proxy.multiParam((a, b, c) => {
      capturedA = a;
      capturedB = b;
      capturedC = c;
    });

    expect(capturedA).toBe(42);
    expect(capturedB).toBe('hello');
    expect(capturedC).toBe(true);
  });

  it('should handle multiple concurrent callbacks', async () => {
    const values: number[] = [];

    await Promise.all([
      proxy.invoke((v) => values.push(v), 1),
      proxy.invoke((v) => values.push(v), 2),
      proxy.invoke((v) => values.push(v), 3)
    ]);

    expect(values.sort()).toEqual([1, 2, 3]);
  });

  it('should handle callback that modifies parent state', async () => {
    let counter = 0;

    await proxy.invokeMultiple(() => {
      counter++;
    }, 10);

    expect(counter).toBe(10);
  });
});
