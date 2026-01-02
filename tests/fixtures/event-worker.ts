import { EventEmitter } from 'events';

/**
 * Event map for EventWorker
 */
interface EventWorkerEvents {
  progress: [percent: number];
  complete: [data: { duration: number; steps: number }];
  multi: [a: number, b: string, c: boolean];
  changed: [value: number];
  event1: [data: string];
  event2: [data: string];
  event3: [data: number];
  _secret: [token: string];
  $cache: [data: string];
}

/**
 * Test fixture: Worker that extends EventEmitter and emits events during operations.
 * Used for US6 (EventEmitter Integration) tests.
 */
export class EventWorker extends EventEmitter<EventWorkerEvents> {
  private value: number = 0;

  /**
   * Start a task that emits progress events.
   */
  async startTask(duration: number): Promise<string> {
    const steps = 5;
    const interval = duration / steps;

    for (let i = 1; i <= steps; i++) {
      await new Promise((resolve) => setTimeout(resolve, interval));
      const percent = (i / steps) * 100;
      this.emit('progress', percent);
    }

    this.emit('complete', { duration, steps });
    return 'Task completed';
  }

  /**
   * Increment internal counter and emit event.
   */
  increment(): number {
    this.value++;
    this.emit('changed', this.value);
    return this.value;
  }

  /**
   * Get current value without emitting.
   */
  getValue(): number {
    return this.value;
  }

  /**
   * Emit multiple event types at once.
   */
  multiEmit(data: string): void {
    this.emit('event1', data);
    this.emit('event2', data.toUpperCase());
    this.emit('event3', data.length);
  }

  /**
   * Emit event with multiple arguments.
   */
  emitMultiArgs(a: number, b: string, c: boolean): void {
    this.emit('multi', a, b, c);
  }

  emitPrivateEvents(): void {
    this.emit('_secret', 'hidden');
    this.emit('$cache', 'cached');
  }
}
