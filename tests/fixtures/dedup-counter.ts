/**
 * Test fixture for deduplication testing.
 * Tracks instance creation count to verify deduplication behavior.
 */
export class DedupCounter {
  private static instanceCount = 0;
  private instanceId: number;
  private value: number;
  private pid: number;

  constructor(initialValue: number = 0) {
    DedupCounter.instanceCount++;
    this.instanceId = DedupCounter.instanceCount;
    this.value = initialValue;
    this.pid = process.pid;
  }

  /**
   * Get the unique ID of this instance (used to verify same instance is returned)
   */
  getInstanceId(): number {
    return this.instanceId;
  }

  /**
   * Get the process ID of the child process
   */
  getProcessId(): number {
    return this.pid;
  }

  /**
   * Get total number of instances created across all processes
   */
  static getInstanceCount(): number {
    return DedupCounter.instanceCount;
  }

  /**
   * Get the current value
   */
  getValue(): number {
    return this.value;
  }

  /**
   * Increment the value
   */
  increment(amount: number = 1): number {
    this.value += amount;
    return this.value;
  }

  /**
   * Reset static counter (for testing)
   */
  static resetCounter(): void {
    DedupCounter.instanceCount = 0;
  }
}
