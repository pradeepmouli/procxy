/**
 * Test fixture: Worker with async methods.
 * Used for US1 (Async Method Handling) tests.
 */
export class AsyncWorker {
  /**
   * Simulate async work (sleep for duration ms, then return result).
   */
  async doWork(durationMs: number, result: string): Promise<string> {
    return new Promise((resolve) => {
      setTimeout(() => resolve(`Completed: ${result}`), durationMs);
    });
  }

  /**
   * Simulate parallel async work.
   */
  async doParallelWork(
    durationMs: number,
    taskCount: number,
  ): Promise<{ completed: number; totalTime: number }> {
    const startTime = Date.now();
    const tasks = Array(taskCount)
      .fill(null)
      .map(() =>
        new Promise<void>((resolve) => {
          setTimeout(resolve, durationMs);
        }),
      );

    await Promise.all(tasks);

    return {
      completed: taskCount,
      totalTime: Date.now() - startTime,
    };
  }

  /**
   * Simulate async work that may fail.
   */
  async mayFail(shouldFail: boolean, message: string): Promise<string> {
    await new Promise((resolve) => setTimeout(resolve, 10));
    if (shouldFail) {
      throw new Error(`Intentional failure: ${message}`);
    }
    return `Success: ${message}`;
  }

  /**
   * Echo input after delay.
   */
  async echo<T>(value: T, delayMs: number = 0): Promise<T> {
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    return value;
  }
}
