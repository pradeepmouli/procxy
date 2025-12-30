/**
 * Error Handling Example
 *
 * This example demonstrates error handling in procxy:
 * - Error propagation from child to parent
 * - Different error types (TimeoutError, ChildCrashedError, etc.)
 * - Stack trace preservation
 * - Retry logic
 */

import { procxy, TimeoutError, ChildCrashedError } from '../src/index';

/**
 * A class with various error scenarios
 */
class ErrorProneWorker {
  throwError(): void {
    throw new Error('This is a simulated error');
  }

  async asyncError(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 10));
    throw new Error('This is an async error');
  }

  divideByZero(a: number, b: number): number {
    if (b === 0) {
      throw new Error('Division by zero is not allowed');
    }
    return a / b;
  }

  async longRunningOperation(): Promise<string> {
    // Simulate a very long operation
    await new Promise((resolve) => setTimeout(resolve, 60000));
    return 'Completed';
  }

  processExit(): void {
    // This will crash the child process
    process.exit(1);
  }

  returnFunction(): Function {
    // This will cause a serialization error
    return () => console.log('Hello');
  }
}

async function basicErrorHandling() {
  console.log('=== Basic Error Handling ===');

  await using worker = await procxy(ErrorProneWorker, './examples/error-handling.ts');

  try {
    await worker.throwError();
  } catch (error) {
    console.error('Caught error:', (error as Error).message);
    console.log('Stack trace preserved:', !!(error as Error).stack);
  }

  console.log();
}

async function asyncErrorHandling() {
  console.log('=== Async Error Handling ===');

  await using worker = await procxy(ErrorProneWorker, './examples/error-handling.ts');

  try {
    await worker.asyncError();
  } catch (error) {
    console.error('Caught async error:', (error as Error).message);
  }

  console.log();
}

async function timeoutHandling() {
  console.log('=== Timeout Error Handling ===');

  // Create worker with short timeout
  await using worker = await procxy(
    ErrorProneWorker,
    './examples/error-handling.ts',
    { timeout: 1000 } // 1 second timeout
  );

  try {
    await worker.longRunningOperation();
  } catch (error) {
    if (error instanceof TimeoutError) {
      console.error('Operation timed out after', error.timeoutMs, 'ms');
    } else {
      console.error('Unexpected error:', error);
    }
  }

  console.log();
}

async function childCrashHandling() {
  console.log('=== Child Crash Handling ===');

  const worker = await procxy(ErrorProneWorker, './examples/error-handling.ts');

  try {
    await worker.processExit();
  } catch (error) {
    if (error instanceof ChildCrashedError) {
      console.error('Child process crashed with code:', error.exitCode);
      console.error('Signal:', error.signal);
    } else {
      console.error('Unexpected error:', error);
    }
  }

  // Worker is already terminated, so don't use await using
  console.log();
}

async function serializationErrorHandling() {
  console.log('=== Serialization Error Handling ===');

  class SerializationWorker {
    processData(data: { value: number }): { result: number } {
      return { result: data.value * 2 };
    }
  }

  await using worker = await procxy(SerializationWorker, './examples/error-handling.ts');

  try {
    // Valid serializable data
    const result = await worker.processData({ value: 42 });
    console.log('✓ Result:', result);

    // Note: Methods returning functions are automatically filtered out by Procxy<T>
    // Only methods with JSON-serializable signatures are included
    console.log('Methods with non-serializable return types are filtered at compile time');
  } catch (error) {
    console.error('Error:', (error as Error).message);
  }

  console.log();
}

async function retryLogic() {
  console.log('=== Retry Logic Example ===');

  let attemptCount = 0;
  const maxAttempts = 3;

  class UnreliableWorker {
    counter = 0;

    async unreliableOperation(): Promise<string> {
      this.counter++;
      if (this.counter < 3) {
        throw new Error(`Failed attempt ${this.counter}`);
      }
      return 'Success!';
    }
  }

  await using worker = await procxy(UnreliableWorker, './examples/error-handling.ts');

  while (attemptCount < maxAttempts) {
    try {
      attemptCount++;
      console.log(`Attempt ${attemptCount}...`);
      const result = await worker.unreliableOperation();
      console.log('✓', result);
      break;
    } catch (error) {
      console.error(`✗ ${(error as Error).message}`);

      if (attemptCount >= maxAttempts) {
        console.error('Max attempts reached');
        break;
      }

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  console.log();
}

async function customErrorHandling() {
  console.log('=== Custom Error Handling ===');

  class ValidationError extends Error {
    constructor(
      message: string,
      public field: string
    ) {
      super(message);
      this.name = 'ValidationError';
    }
  }

  class ValidatingWorker {
    validateAge(age: number): boolean {
      if (age < 0 || age > 150) {
        throw new ValidationError('Age must be between 0 and 150', 'age');
      }
      return true;
    }
  }

  await using worker = await procxy(ValidatingWorker, './examples/error-handling.ts');

  try {
    await worker.validateAge(-5);
  } catch (error) {
    console.error('Validation failed:', (error as Error).message);
    // Note: Custom error class properties might not be preserved across IPC
  }

  console.log();
}

async function multipleErrorsHandling() {
  console.log('=== Handling Multiple Operations ===');

  await using worker = await procxy(ErrorProneWorker, './examples/error-handling.ts');

  const operations = [
    { name: 'divide 10/2', fn: () => worker.divideByZero(10, 2) },
    { name: 'divide 10/0', fn: () => worker.divideByZero(10, 0) },
    { name: 'divide 20/4', fn: () => worker.divideByZero(20, 4) }
  ];

  for (const op of operations) {
    try {
      const result = await op.fn();
      console.log(`✓ ${op.name} = ${result}`);
    } catch (error) {
      console.error(`✗ ${op.name}: ${(error as Error).message}`);
    }
  }

  console.log();
}

async function main() {
  await basicErrorHandling();
  await asyncErrorHandling();
  await timeoutHandling();
  await childCrashHandling();
  await serializationErrorHandling();
  await retryLogic();
  await customErrorHandling();
  await multipleErrorsHandling();
}
await main();

export { ErrorProneWorker };
