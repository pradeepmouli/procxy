/**
 * Example: Error Preservation with Advanced Serialization
 *
 * Demonstrates full Error object preservation including:
 * - Custom error properties
 * - Stack traces
 * - Error inheritance
 * - Nested errors (cause chain)
 */

import { procxy } from '../../src/index.js';

/**
 * Custom error with additional context
 */
class ValidationError extends Error {
  constructor(
    message: string,
    public field: string,
    public value: any,
    public constraints: string[]
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Custom error with nested cause
 */
class ProcessingError extends Error {
  constructor(
    message: string,
    public operationId: string,
    public timestamp: Date,
    cause?: Error
  ) {
    super(message, { cause });
    this.name = 'ProcessingError';
  }
}

/**
 * Service that throws various types of errors
 */
class ErrorService {
  /**
   * Validate input and throw custom error
   */
  validateAge(age: number): void {
    if (age < 0) {
      throw new ValidationError('Age cannot be negative', 'age', age, ['min:0', 'type:number']);
    }
    if (age > 150) {
      throw new ValidationError('Age is unrealistically high', 'age', age, [
        'max:150',
        'type:number'
      ]);
    }
  }

  /**
   * Process data with error chaining
   */
  async processData(data: string): Promise<string> {
    try {
      // Simulate validation error
      if (data.length === 0) {
        throw new ValidationError('Data cannot be empty', 'data', data, [
          'required',
          'minLength:1'
        ]);
      }

      // Simulate processing
      const result = data.toUpperCase();
      return result;
    } catch (error) {
      // Wrap in processing error
      throw new ProcessingError('Failed to process data', 'proc-001', new Date(), error as Error);
    }
  }

  /**
   * Throw standard error
   */
  throwStandardError(): never {
    const error = new Error('Something went wrong');
    error.stack = 'Error: Something went wrong\n    at ErrorService.throwStandardError';
    throw error;
  }

  /**
   * Throw error with custom properties
   */
  throwWithProperties(): never {
    const error = new Error('Error with metadata') as Error & {
      code: string;
      statusCode: number;
      metadata: Record<string, any>;
    };
    error.code = 'ERR_CUSTOM';
    error.statusCode = 500;
    error.metadata = {
      requestId: 'req-123',
      timestamp: new Date(),
      retryable: true
    };
    throw error;
  }

  /**
   * Return error without throwing
   */
  createError(): Error {
    return new ValidationError('Email format is invalid', 'email', 'not-an-email', [
      'format:email',
      'required'
    ]);
  }
}

async function main() {
  console.log('🚨 Error Preservation Example\n');

  console.log('Creating ErrorService with advanced serialization...');
  await using service = await procxy(ErrorService, undefined, { serialization: 'advanced' });

  // Example 1: Custom validation error
  console.log('\n📝 Example 1: Validation error with custom properties');
  try {
    await service.validateAge(-5);
  } catch (error) {
    if (error instanceof ValidationError) {
      console.log('Caught ValidationError:');
      console.log('  Name:', error.name);
      console.log('  Message:', error.message);
      console.log('  Field:', error.field);
      console.log('  Value:', error.value);
      console.log('  Constraints:', error.constraints);
      console.log('  Stack preserved:', error.stack?.includes('validateAge'));
    }
  }

  // Example 2: Error chaining with cause
  console.log('\n📝 Example 2: Error chaining (nested errors)');
  try {
    await service.processData('');
  } catch (error) {
    if (error instanceof ProcessingError) {
      console.log('Caught ProcessingError:');
      console.log('  Name:', error.name);
      console.log('  Message:', error.message);
      console.log('  Operation ID:', error.operationId);
      console.log('  Timestamp:', error.timestamp);

      if (error.cause instanceof ValidationError) {
        console.log('  Cause:', error.cause.name);
        console.log('    Message:', error.cause.message);
        console.log('    Field:', error.cause.field);
        console.log('    Constraints:', error.cause.constraints);
      }
    }
  }

  // Example 3: Standard error
  console.log('\n📝 Example 3: Standard Error object');
  try {
    await service.throwStandardError();
  } catch (error) {
    if (error instanceof Error) {
      console.log('Caught Error:');
      console.log('  Name:', error.name);
      console.log('  Message:', error.message);
      console.log('  Stack:', error.stack?.split('\n')[0]);
    }
  }

  // Example 4: Error with dynamic properties
  console.log('\n📝 Example 4: Error with custom properties');
  try {
    await service.throwWithProperties();
  } catch (error: any) {
    console.log('Caught Error with properties:');
    console.log('  Message:', error.message);
    console.log('  Code:', error.code);
    console.log('  Status Code:', error.statusCode);
    console.log('  Metadata:', error.metadata);
    console.log('  Retryable:', error.metadata?.retryable);
  }

  // Example 5: Error as return value
  console.log('\n📝 Example 5: Error as return value (not thrown)');
  const error = await service.createError();
  if (error instanceof ValidationError) {
    console.log('Received ValidationError:');
    console.log('  Message:', error.message);
    console.log('  Field:', error.field);
    console.log('  Value:', error.value);
    console.log('  Constraints:', error.constraints);
  }

  console.log('\n✅ Error preservation completed successfully!');
  console.log('\n💡 With JSON mode, you would lose:');
  console.log('   • Error prototype chain (instanceof checks fail)');
  console.log('   • Custom properties on Error objects');
  console.log('   • Nested cause chain');
  console.log('   • Proper stack traces');
  console.log('   • Error.cause support (ES2022)');
}

// Run the example
main().catch(console.error);
