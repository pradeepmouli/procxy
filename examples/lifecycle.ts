/**
 * Lifecycle Management Example
 *
 * This example demonstrates lifecycle management in procxy:
 * - Manual termination with $terminate()
 * - Automatic cleanup with disposables (using/await using)
 * - Process access via $process property
 * - Multiple instances management
 */

import { procxy } from '../src/index';

/**
 * A worker class with lifecycle hooks
 */
class LifecycleWorker {
  private startTime: number;
  private callCount: number = 0;

  constructor(public name: string) {
    this.startTime = Date.now();
    console.log(`[Child ${name}] Worker initialized at ${new Date().toISOString()}`);
  }

  async doWork(taskId: number): Promise<string> {
    this.callCount++;
    const elapsed = Date.now() - this.startTime;
    console.log(
      `[Child ${this.name}] Processing task ${taskId} (call #${this.callCount}, uptime: ${elapsed}ms)`
    );

    await new Promise((resolve) => setTimeout(resolve, 100));

    return `Task ${taskId} completed by ${this.name}`;
  }

  getStats(): { name: string; uptime: number; calls: number } {
    return {
      name: this.name,
      uptime: Date.now() - this.startTime,
      calls: this.callCount
    };
  }
}

async function manualLifecycle() {
  console.log('=== Manual Lifecycle Management ===');

  // Create worker
  const worker = await procxy(LifecycleWorker, './examples/lifecycle.ts', undefined, 'Worker-1');

  // Do some work
  await worker.doWork(1);
  await worker.doWork(2);

  // Get stats
  const stats = await worker.getStats();
  console.log('Stats:', stats);

  // Manual termination
  await worker.$terminate();
  console.log('Worker terminated manually\n');
}

async function automaticLifecycle() {
  console.log('=== Automatic Lifecycle with await using ===');

  // Worker is automatically terminated when scope exits
  await using worker = await procxy(
    LifecycleWorker,
    './examples/lifecycle.ts',
    undefined,
    'Worker-2'
  );

  await worker.doWork(1);
  await worker.doWork(2);

  const stats = await worker.getStats();
  console.log('Stats:', stats);

  console.log('Worker will be terminated automatically when scope exits\n');
  // Automatic cleanup happens here
}

async function syncDisposable() {
  console.log('=== Sync Disposable (using) ===');

  // Note: This uses Symbol.dispose (sync) instead of Symbol.asyncDispose
  using worker = await procxy(LifecycleWorker, './examples/lifecycle.ts', undefined, 'Worker-3');

  await worker.doWork(1);

  console.log('Worker will be disposed synchronously when scope exits\n');
  // Sync disposal happens here
}

async function multipleInstances() {
  console.log('=== Managing Multiple Instances ===');

  // Create multiple workers
  const worker1 = await procxy(LifecycleWorker, './examples/lifecycle.ts', undefined, 'Worker-A');
  const worker2 = await procxy(LifecycleWorker, './examples/lifecycle.ts', undefined, 'Worker-B');
  const worker3 = await procxy(LifecycleWorker, './examples/lifecycle.ts', undefined, 'Worker-C');

  // Distribute work
  await Promise.all([worker1.doWork(1), worker2.doWork(2), worker3.doWork(3)]);

  // Get all stats
  const [stats1, stats2, stats3] = await Promise.all([
    worker1.getStats(),
    worker2.getStats(),
    worker3.getStats()
  ]);

  console.log('Worker stats:', [stats1, stats2, stats3]);

  // Clean up all workers
  await Promise.all([worker1.$terminate(), worker2.$terminate(), worker3.$terminate()]);

  console.log('All workers terminated\n');
}

async function processAccess() {
  console.log('=== Accessing Child Process ===');

  const worker = await procxy(
    LifecycleWorker,
    './examples/lifecycle.ts',
    undefined,
    'Worker-Process'
  );

  // Access the underlying ChildProcess
  console.log('Child process PID:', worker.$process.pid);
  console.log('Child process connected:', worker.$process.connected);

  // Listen to process events
  worker.$process.on('exit', (code, signal) => {
    console.log(`Child process exited with code ${code}, signal ${signal}`);
  });

  await worker.doWork(1);

  await worker.$terminate();
  console.log();
}

async function errorInLifecycle() {
  console.log('=== Error Handling in Lifecycle ===');

  class ErrorWorker {
    constructor() {
      console.log('[Child ErrorWorker] Initialized');
    }

    async failingMethod(): Promise<void> {
      throw new Error('Method failed!');
    }
  }

  try {
    await using worker = await procxy(ErrorWorker, './examples/lifecycle.ts');

    try {
      await worker.failingMethod();
    } catch (error) {
      console.error('Method error:', (error as Error).message);
    }

    // Worker is still terminated even if method throws
    console.log('Worker will be terminated despite error\n');
  } catch (error) {
    console.error('Lifecycle error:', error);
  }
}

async function longLivedWorker() {
  console.log('=== Long-Lived Worker ===');

  const worker = await procxy(LifecycleWorker, './examples/lifecycle.ts', undefined, 'Long-Lived');

  // Simulate a long-running worker
  for (let i = 1; i <= 5; i++) {
    await worker.doWork(i);
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  const stats = await worker.getStats();
  console.log('Final stats:', stats);

  await worker.$terminate();
  console.log();
}

async function workerPool() {
  console.log('=== Simple Worker Pool ===');

  // Create a pool of workers
  const poolSize = 3;
  const workers = await Promise.all(
    Array.from({ length: poolSize }, (_, i) =>
      procxy(LifecycleWorker, './examples/lifecycle.ts', undefined, `Pool-Worker-${i + 1}`)
    )
  );

  // Distribute tasks across pool
  const tasks = Array.from({ length: 10 }, (_, i) => i + 1);
  const results: string[] = [];

  for (const task of tasks) {
    const worker = workers[task % poolSize];
    const result = await worker.doWork(task);
    results.push(result);
  }

  console.log(`Completed ${results.length} tasks using ${poolSize} workers`);

  // Get stats from all workers
  const allStats = await Promise.all(workers.map((w) => w.getStats()));
  console.log('Pool stats:', allStats);

  // Clean up pool
  await Promise.all(workers.map((w) => w.$terminate()));
  console.log('Pool terminated\n');
}

async function gracefulShutdown() {
  console.log('=== Graceful Shutdown ===');

  const worker = await procxy(LifecycleWorker, './examples/lifecycle.ts', undefined, 'Graceful');

  // Start some work
  const workPromise = worker.doWork(1);

  // Wait for work to complete before terminating
  await workPromise;

  console.log('Work completed, shutting down gracefully');
  await worker.$terminate();
  console.log();
}

async function main() {
  await manualLifecycle();
  await automaticLifecycle();
  await syncDisposable();
  await multipleInstances();
  await processAccess();
  await errorInLifecycle();
  await longLivedWorker();
  await workerPool();
  await gracefulShutdown();
}

await main();

export { LifecycleWorker };
