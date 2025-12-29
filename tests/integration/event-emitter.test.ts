import { describe, it, expect, afterEach } from 'vitest';
import { resolve } from 'path';
import { procxy } from '../../src/index.js';
import { EventWorker } from '../fixtures/event-worker.js';

// Use absolute paths for module resolution
const EVENT_WORKER_PATH = resolve(process.cwd(), 'tests/fixtures/event-worker.ts');

describe('EventEmitter Integration', () => {
  const activeProxies: Array<{ $terminate: () => Promise<void> }> = [];

  afterEach(async () => {
    // Clean up any proxies that weren't terminated in the test
    await Promise.all(activeProxies.map((p) => p.$terminate().catch(() => {})));
    activeProxies.length = 0;
  });

  describe('event forwarding', () => {
    it('should forward events from child to parent', async () => {
      const worker = await procxy(EventWorker, {
        modulePath: EVENT_WORKER_PATH,
      });
      activeProxies.push(worker);

      const events: number[] = [];
      worker.on('progress', (percent: number) => {
        events.push(percent);
      });

      await worker.startTask(200);

      expect(events).toHaveLength(5);
      expect(events).toEqual([20, 40, 60, 80, 100]);

      await worker.$terminate();
    });

    it('should forward complete event with object payload', async () => {
      const worker = await procxy(EventWorker, {
        modulePath: EVENT_WORKER_PATH,
      });
      activeProxies.push(worker);

      const completeData = await new Promise((resolve) => {
        worker.on('complete', (data: { duration: number; steps: number }) => {
          resolve(data);
        });
        worker.startTask(100);
      });

      expect(completeData).toEqual({ duration: 100, steps: 5 });

      await worker.$terminate();
    });

    it('should forward events with multiple arguments', async () => {
      const worker = await procxy(EventWorker, {
        modulePath: EVENT_WORKER_PATH,
      });
      activeProxies.push(worker);

      const received = await new Promise((resolve) => {
        worker.on('multi', (a: number, b: string, c: boolean) => {
          resolve({ a, b, c });
        });
        worker.emitMultiArgs(42, 'test', true);
      });

      expect(received).toEqual({ a: 42, b: 'test', c: true });

      await worker.$terminate();
    });
  });

  describe('multiple listeners', () => {
    it('should support multiple listeners on same event', async () => {
      const worker = await procxy(EventWorker, {
        modulePath: EVENT_WORKER_PATH,
      });
      activeProxies.push(worker);

      const listener1Values: number[] = [];
      const listener2Values: number[] = [];

      worker.on('changed', (value: number) => {
        listener1Values.push(value);
      });

      worker.on('changed', (value: number) => {
        listener2Values.push(value * 2);
      });

      await worker.increment();
      await worker.increment();
      await worker.increment();

      expect(listener1Values).toEqual([1, 2, 3]);
      expect(listener2Values).toEqual([2, 4, 6]);

      await worker.$terminate();
    });

    it('should support .once() for one-time listeners', async () => {
      const worker = await procxy(EventWorker, {
        modulePath: EVENT_WORKER_PATH,
      });
      activeProxies.push(worker);

      const values: number[] = [];

      worker.once('changed', (value: number) => {
        values.push(value);
      });

      await worker.increment(); // Should trigger
      await worker.increment(); // Should not trigger
      await worker.increment(); // Should not trigger

      expect(values).toEqual([1]); // Only first value

      await worker.$terminate();
    });

    it('should support .off() to remove listeners', async () => {
      const worker = await procxy(EventWorker, {
        modulePath: EVENT_WORKER_PATH,
      });
      activeProxies.push(worker);

      const values: number[] = [];
      const listener = (value: number) => {
        values.push(value);
      };

      worker.on('changed', listener);

      await worker.increment(); // Should trigger

      worker.off('changed', listener);

      await worker.increment(); // Should not trigger
      await worker.increment(); // Should not trigger

      expect(values).toEqual([1]); // Only first value

      await worker.$terminate();
    });
  });

  describe('multiple event types', () => {
    it('should handle multiple different event types', async () => {
      const worker = await procxy(EventWorker, {
        modulePath: EVENT_WORKER_PATH,
      });
      activeProxies.push(worker);

      const event1Data: string[] = [];
      const event2Data: string[] = [];
      const event3Data: number[] = [];

      worker.on('event1', (data: string) => event1Data.push(data));
      worker.on('event2', (data: string) => event2Data.push(data));
      worker.on('event3', (data: number) => event3Data.push(data));

      await worker.multiEmit('hello');
      await worker.multiEmit('world');

      expect(event1Data).toEqual(['hello', 'world']);
      expect(event2Data).toEqual(['HELLO', 'WORLD']);
      expect(event3Data).toEqual([5, 5]);

      await worker.$terminate();
    });
  });

  describe('method calls and events', () => {
    it('should handle concurrent method calls and events', async () => {
      const worker = await procxy(EventWorker, {
        modulePath: EVENT_WORKER_PATH,
      });
      activeProxies.push(worker);

      const progressEvents: number[] = [];
      worker.on('progress', (percent: number) => {
        progressEvents.push(percent);
      });

      const [result, value] = await Promise.all([
        worker.startTask(150),
        worker.getValue(),
      ]);

      expect(result).toBe('Task completed');
      expect(value).toBe(0);
      expect(progressEvents.length).toBeGreaterThan(0);

      await worker.$terminate();
    });
  });
});
