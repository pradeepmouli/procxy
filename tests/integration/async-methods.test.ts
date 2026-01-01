import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { procxy } from '../../src/index.js';
import { AsyncWorker } from '../fixtures/async-worker.js';

const workerPath = resolve(process.cwd(), 'tests/fixtures/async-worker.ts');

describe('Async Method Invocation (US1)', () => {
  it('handles async methods with delays', async () => {
    await using proxy = await procxy(AsyncWorker, workerPath);
    const result = await proxy.doWork(20, 'task');
    expect(result).toBe('Completed: task');
  });

  it('handles async methods returning complex objects', async () => {
    await using proxy = await procxy(AsyncWorker, workerPath);
    const result = await proxy.doParallelWork(10, 3);
    expect(result.completed).toBe(3);
    expect(result.totalTime).toBeGreaterThanOrEqual(10);
  });

  it('supports concurrent async calls', async () => {
    await using proxy = await procxy(AsyncWorker, workerPath);

    const results = await Promise.all([
      proxy.doWork(5, 'a'),
      proxy.doWork(5, 'b'),
      proxy.doWork(5, 'c')
    ]);

    expect(results).toEqual(['Completed: a', 'Completed: b', 'Completed: c']);
  });

  it('propagates async errors', async () => {
    await using proxy = await procxy(AsyncWorker, workerPath);
    await expect(proxy.mayFail(true, 'oops')).rejects.toThrow('Intentional failure: oops');
  });

  it('echoes complex values', async () => {
    await using proxy = await procxy(AsyncWorker, workerPath);
    const payload = { key: 'value', nested: { data: [1, 2, 3] } };
    const result = await proxy.echo(payload, 0);
    expect(result).toEqual(payload);
  });
});
