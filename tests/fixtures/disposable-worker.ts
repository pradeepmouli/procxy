/**
 * Test fixture: Class that implements disposable protocol.
 * Used for testing disposal propagation from parent to child.
 */
export class DisposableWorker {
  private disposed = false;
  private asyncDisposed = false;
  private cleanupLog: string[] = [];

  /**
   * Check if dispose was called
   */
  isDisposed(): boolean {
    return this.disposed;
  }

  /**
   * Check if async dispose was called
   */
  isAsyncDisposed(): boolean {
    return this.asyncDisposed;
  }

  /**
   * Get cleanup log
   */
  getCleanupLog(): string[] {
    return [...this.cleanupLog];
  }

  /**
   * Do some work
   */
  async doWork(data: string): Promise<string> {
    if (this.disposed || this.asyncDisposed) {
      throw new Error('Worker has been disposed');
    }
    return `Processed: ${data}`;
  }

  /**
   * Sync disposable implementation
   */
  [Symbol.dispose](): void {
    this.cleanupLog.push('Symbol.dispose called');
    this.disposed = true;
  }

  /**
   * Async disposable implementation
   */
  async [Symbol.asyncDispose](): Promise<void> {
    this.cleanupLog.push('Symbol.asyncDispose called');
    await new Promise((resolve) => setTimeout(resolve, 50)); // Simulate async cleanup
    this.asyncDisposed = true;
  }
}
