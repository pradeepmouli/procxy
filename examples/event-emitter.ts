/**
 * EventEmitter Example
 *
 * This example demonstrates how EventEmitter support works in procxy:
 * - Events emitted in the child process are forwarded to the parent
 * - Standard EventEmitter API works transparently
 * - Events flow from child to parent only
 */

import { EventEmitter } from 'events';
import { procxy } from '../src/index';

/**
 * A worker class that extends EventEmitter and emits progress events
 */
class ProgressWorker extends EventEmitter {
  async processData(items: string[]): Promise<string[]> {
    const results: string[] = [];

    for (let i = 0; i < items.length; i++) {
      // Simulate processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Emit progress event
      const progress = Math.round(((i + 1) / items.length) * 100);
      this.emit('progress', { current: i + 1, total: items.length, percent: progress });

      // Process item
      results.push(items[i].toUpperCase());
    }

    // Emit completion event
    this.emit('complete', { processed: results.length });

    return results;
  }

  async longRunningTask(duration: number): Promise<string> {
    const start = Date.now();
    const steps = 10;
    const stepDuration = duration / steps;

    for (let i = 0; i < steps; i++) {
      await new Promise((resolve) => setTimeout(resolve, stepDuration));

      this.emit('step', {
        step: i + 1,
        totalSteps: steps,
        elapsed: Date.now() - start
      });
    }

    this.emit('finished', { totalTime: Date.now() - start });

    return 'Task completed';
  }
}

/**
 * A data stream that emits data chunks
 */
class DataStream extends EventEmitter {
  private intervalId?: NodeJS.Timeout;

  async start(): Promise<void> {
    let counter = 0;

    this.intervalId = setInterval(() => {
      this.emit('data', { chunk: counter++, timestamp: Date.now() });

      if (counter >= 5) {
        this.stop();
      }
    }, 200);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
      this.emit('end', { totalChunks: 5 });
    }
  }
}

async function progressExample() {
  console.log('=== Progress Events Example ===');

  await using worker = await procxy(ProgressWorker, './examples/event-emitter.ts');

  // Listen to progress events
  worker.on('progress', (data) => {
    console.log(`Progress: ${data.percent}% (${data.current}/${data.total})`);
  });

  worker.on('complete', (data) => {
    console.log(`✓ Complete! Processed ${data.processed} items\n`);
  });

  const items = ['apple', 'banana', 'cherry', 'date', 'elderberry'];
  const results = await worker.processData(items);

  console.log('Results:', results);
  console.log();
}

async function longTaskExample() {
  console.log('=== Long Running Task Example ===');

  await using worker = await procxy(ProgressWorker, './examples/event-emitter.ts');

  worker.on('step', (data) => {
    console.log(`Step ${data.step}/${data.totalSteps} (elapsed: ${data.elapsed}ms)`);
  });

  worker.on('finished', (data) => {
    console.log(`✓ Task finished in ${data.totalTime}ms\n`);
  });

  await worker.longRunningTask(1000);
  console.log();
}

async function dataStreamExample() {
  console.log('=== Data Stream Example ===');

  await using stream = await procxy(DataStream, './examples/event-emitter.ts');

  stream.on('data', (data) => {
    console.log(`Received chunk ${data.chunk} at ${data.timestamp}`);
  });

  stream.on('end', (data) => {
    console.log(`✓ Stream ended. Total chunks: ${data.totalChunks}\n`);
  });

  await stream.start();

  // Wait a bit for all events to be received
  await new Promise((resolve) => setTimeout(resolve, 1500));
}

async function errorEventsExample() {
  console.log('=== Error Events Example ===');

  class ErrorEmitter extends EventEmitter {
    async doWork(): Promise<void> {
      // Simulate some work
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Emit an error event
      this.emit('error', new Error('Something went wrong!'));
    }
  }

  await using emitter = await procxy(ErrorEmitter, './examples/event-emitter.ts');

  emitter.on('error', (error) => {
    console.error('Received error event:', error.message);
  });

  await emitter.doWork();

  console.log();
}

async function main() {
  await progressExample();
  await longTaskExample();
  await dataStreamExample();
  await errorEventsExample();
}

await main();

export { ProgressWorker, DataStream };
