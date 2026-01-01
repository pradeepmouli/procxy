import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { procxy } from '../../src/index.js';
import { BrokenWorker } from '../fixtures/broken-worker.js';

const brokenPath = resolve(process.cwd(), 'tests/fixtures/broken-worker.ts');

describe('Error Propagation (US1)', () => {
  it('propagates synchronous errors', async () => {
    await using proxy = await procxy(BrokenWorker, brokenPath);
    await expect(proxy.throwSync('Sync error')).rejects.toThrow('Sync error');
  });

  it('propagates async errors', async () => {
    await using proxy = await procxy(BrokenWorker, brokenPath);
    await expect(proxy.throwAsync('Async error')).rejects.toThrow('Async error');
  });

  it('preserves error types', async () => {
    await using proxy = await procxy(BrokenWorker, brokenPath);

    try {
      await proxy.throwErrorType('TypeError', 'Type problem');
      expect.fail('Should have thrown');
    } catch (error: any) {
      expect(error.name).toBe('TypeError');
      expect(error.message).toBe('Type problem');
    }

    try {
      await proxy.throwErrorType('RangeError', 'Range problem');
      expect.fail('Should have thrown');
    } catch (error: any) {
      expect(error.name).toBe('RangeError');
      expect(error.message).toBe('Range problem');
    }

    try {
      await proxy.throwErrorType('ReferenceError', 'Ref problem');
      expect.fail('Should have thrown');
    } catch (error: any) {
      expect(error.name).toBe('ReferenceError');
      expect(error.message).toBe('Ref problem');
    }
  });

  it('keeps stack traces', async () => {
    await using proxy = await procxy(BrokenWorker, brokenPath);
    await expect(proxy.throwWithStack('Error with custom stack')).rejects.toThrow(/custom stack/);
  });

  it('handles delayed errors', async () => {
    await using proxy = await procxy(BrokenWorker, brokenPath);
    await expect(proxy.throwAfterDelay(10, 'Error after delay')).rejects.toThrow(
      'Error after delay'
    );
  });

  it('handles conditional errors independently', async () => {
    await using proxy = await procxy(BrokenWorker, brokenPath);

    const results = await Promise.allSettled([
      proxy.conditionalThrow(false, 'ok1'),
      proxy.throwSync('fail'),
      proxy.conditionalThrow(false, 'ok2'),
      proxy.throwAsync('async fail')
    ]);

    expect(results[0].status).toBe('fulfilled');
    expect(results[2].status).toBe('fulfilled');
    expect(results[1].status).toBe('rejected');
    expect(results[3].status).toBe('rejected');
  });
});
