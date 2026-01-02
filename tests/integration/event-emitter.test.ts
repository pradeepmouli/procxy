import { describe, it, expect } from 'vitest';
import { procxy } from '../../src/index.js';
import { EventWorker } from '../fixtures/event-worker.js';

describe('EventEmitter Integration', () => {
  describe('event forwarding', () => {
    it('should forward events from child to parent', async () => {
      await using worker = await procxy(EventWorker);

      const events: number[] = [];
      worker.on('progress', (percent: number) => {
        events.push(percent);
      });

      await worker.startTask(200);

      expect(events).toHaveLength(5);
      expect(events).toEqual([20, 40, 60, 80, 100]);
    });

    it('should forward complete event with object payload', async () => {
      await using worker = await procxy(EventWorker);

      const completeData = await new Promise((resolve) => {
        worker.on('complete', (data: { duration: number; steps: number }) => {
          resolve(data);
        });
        worker.startTask(100);
      });

      expect(completeData).toEqual({ duration: 100, steps: 5 });
    });

    it('should forward events with multiple arguments', async () => {
      await using worker = await procxy(EventWorker);

      const received = await new Promise((resolve) => {
        worker.on('multi', (a: number, b: string, c: boolean) => {
          resolve({ a, b, c });
        });
        worker.emitMultiArgs(42, 'test', true);
      });

      expect(received).toEqual({ a: 42, b: 'test', c: true });
    });

    it('should not forward private-like events prefixed with _ or $', async () => {
      await using worker = await procxy(EventWorker);

      const received: string[] = [];

      worker.on('_secret', (token: string) => {
        received.push(`secret:${token}`);
      });

      worker.on('$cache', (data: string) => {
        received.push(`cache:${data}`);
      });

      worker.emitPrivateEvents();

      await new Promise((resolve) => setTimeout(resolve, 30));

      expect(received).toEqual([]);
    });
  });

  describe('multiple listeners', () => {
    it('should support multiple listeners on same event', async () => {
      await using worker = await procxy(EventWorker);

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
    });

    it('should support .once() for one-time listeners', async () => {
      await using worker = await procxy(EventWorker);

      const values: number[] = [];

      worker.once('changed', (value: number) => {
        values.push(value);
      });

      await worker.increment(); // Should trigger
      await worker.increment(); // Should not trigger
      await worker.increment(); // Should not trigger

      expect(values).toEqual([1]); // Only first value
    });

    it('should support .off() to remove listeners', async () => {
      await using worker = await procxy(EventWorker);

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
    });
  });

  describe('multiple event types', () => {
    it('should handle multiple different event types', async () => {
      await using worker = await procxy(EventWorker);

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
    });
  });

  describe('method calls and events', () => {
    it('should handle concurrent method calls and events', async () => {
      await using worker = await procxy(EventWorker);

      const progressEvents: number[] = [];
      worker.on('progress', (percent: number) => {
        progressEvents.push(percent);
      });

      const [result, value] = await Promise.all([worker.startTask(150), worker.getValue()]);

      expect(result).toBe('Task completed');
      expect(value).toBe(0);
      expect(progressEvents.length).toBeGreaterThan(0);
    });

    it('should handle listeners added after instantiation', async () => {
      await using worker = await procxy(EventWorker);

      // Call a method first without any listeners
      await worker.increment(); // value = 1

      // Now add a listener AFTER some method calls
      const events: number[] = [];
      worker.on('changed', (value: number) => {
        events.push(value);
      });

      // These events should be captured
      await worker.increment(); // value = 2
      await worker.increment(); // value = 3

      expect(events).toEqual([2, 3]);
    });

    it('should not forward events when no listeners are attached', async () => {
      await using worker = await procxy(EventWorker);

      // Call methods that emit events, but don't add any listeners
      // This tests the optimization - events should not be forwarded over IPC
      await worker.increment(); // emits 'changed'
      await worker.increment(); // emits 'changed'
      await worker.increment(); // emits 'changed'

      // Now add a listener to verify future events work
      const events: number[] = [];
      worker.on('changed', (value: number) => {
        events.push(value);
      });

      await worker.increment(); // value = 4, should be captured

      expect(events).toEqual([4]);
    });
  });
});
