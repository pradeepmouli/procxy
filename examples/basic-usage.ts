/**
 * Basic Usage Example
 *
 * This example demonstrates the fundamental usage of procxy:
 * - Creating a proxy to a class in a child process
 * - Calling methods remotely
 * - Proper cleanup with disposables
 */

import { procxy } from '../src/index';

// Define a simple Calculator class
class Calculator {
  add(a: number, b?: number): number {
    return a + (b ?? 0);
  }

  subtract(a: number, b: number): number {
    return a - b;
  }

  multiply(a: number, b: number): number {
    return a * b;
  }

  divide(a: number, b: number): number {
    if (b === 0) {
      throw new Error('Division by zero');
    }
    return a / b;
  }
}

async function manualCleanup() {
  console.log('=== Manual Cleanup Example ===');

  // Create a remote calculator instance
  const calc = await procxy(Calculator, './examples/basic-usage.ts');

  // Call methods (all return Promises)
  const sum = await calc.add(10, 5);
  console.log('10 + 5 =', sum);

  const product = await calc.multiply(10, 5);
  console.log('10 × 5 =', product);

  const quotient = await calc.divide(10, 5);
  console.log('10 ÷ 5 =', quotient);

  // Manual cleanup
  await calc.$terminate();
  console.log('Calculator terminated\n');
}

async function automaticCleanup() {
  console.log('=== Automatic Cleanup Example (await using) ===');

  // Using await using for automatic cleanup
  await using calc = await procxy(Calculator, './examples/basic-usage.ts');

  const sum = await calc.add(20, 30);
  console.log('20 + 30 =', sum);

  const difference = await calc.subtract(50, 15);
  console.log('50 - 15 =', difference);

  // calc is automatically terminated when scope exits
  console.log('Calculator will be auto-terminated\n');
}

async function errorHandling() {
  console.log('=== Error Handling Example ===');

  await using calc = await procxy(Calculator, './examples/basic-usage.ts');

  try {
    // This will throw an error in the child process
    await calc.divide(10, 0);
  } catch (error) {
    console.error('Caught error:', (error as Error).message);
    console.log('Error was propagated from child process\n');
  }
}

async function main() {
  await manualCleanup();
  await automaticCleanup();
  await errorHandling();
}

await main();

export { Calculator };
