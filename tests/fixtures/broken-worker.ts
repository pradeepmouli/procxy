/**
 * Test fixture: Worker that throws errors.
 * Used for US1 (Error Propagation) and general error handling tests.
 */
export class BrokenWorker {
  /**
   * Throw synchronous error.
   */
  throwSync(message: string): never {
    throw new Error(message);
  }

  /**
   * Throw async error.
   */
  async throwAsync(message: string): Promise<never> {
    await new Promise((resolve) => setTimeout(resolve, 10));
    throw new Error(message);
  }

  /**
   * Throw specific error type.
   */
  throwErrorType(errorType: 'TypeError' | 'RangeError' | 'ReferenceError', message: string): never {
    switch (errorType) {
      case 'TypeError':
        throw new TypeError(message);
      case 'RangeError':
        throw new RangeError(message);
      case 'ReferenceError':
        throw new ReferenceError(message);
    }
  }

  /**
   * Throw custom error with stack trace.
   */
  throwWithStack(message: string): never {
    const error = new Error(message);
    // Modify stack to include additional context
    error.stack = `${error.stack}\nAdditional context: Called from BrokenWorker`;
    throw error;
  }

  /**
   * Simulate timeout scenario (sleep long).
   */
  async sleepLong(durationMs: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, durationMs);
    });
  }

  /**
   * Throw error after some delay.
   */
  async throwAfterDelay(delayMs: number, message: string): Promise<never> {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    throw new Error(message);
  }

  /**
   * Conditional throw (pass test that throws based on condition).
   */
  conditionalThrow(shouldThrow: boolean, message: string): string {
    if (shouldThrow) {
      throw new Error(message);
    }
    return `Success: ${message}`;
  }
}
