import { EventEmitter } from 'events';

/**
 * Test fixture: Worker that extends EventEmitter.
 * Used for US6 (EventEmitter Integration) tests.
 */
export class EventWorker extends EventEmitter {
  private taskInProgress: boolean = false;

  /**
   * Simulate long-running work that emits progress events.
   */
  async doWorkWithProgress(stepCount: number): Promise<string> {
    if (this.taskInProgress) {
      throw new Error('Task already in progress');
    }

    this.taskInProgress = true;

    try {
      for (let i = 1; i <= stepCount; i++) {
        // Emit progress event
        this.emit('progress', {
          step: i,
          total: stepCount,
          percent: Math.round((i / stepCount) * 100),
        });

        // Simulate work
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      this.emit('complete', { stepCount, success: true });
      return `Completed ${stepCount} steps`;
    } catch (error) {
      this.emit('error', error instanceof Error ? error.message : String(error));
      throw error;
    } finally {
      this.taskInProgress = false;
    }
  }

  /**
   * Emit custom event with data.
   */
  async emitCustomEvent(eventName: string, data: unknown): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 10));
    this.emit(eventName, data);
  }

  /**
   * Get current task status.
   */
  isWorking(): boolean {
    return this.taskInProgress;
  }
}

// Type for progress event
export interface ProgressEvent {
  step: number;
  total: number;
  percent: number;
}

// Type for complete event
export interface CompleteEvent {
  stepCount: number;
  success: boolean;
}
