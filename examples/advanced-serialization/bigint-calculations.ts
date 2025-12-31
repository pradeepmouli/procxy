/**
 * Example: BigInt Calculations with Advanced Serialization
 *
 * Demonstrates using BigInt for large number calculations with procxy.
 * Requires serialization: 'advanced' mode.
 */

import { procxy } from '../../src/index.js';
import { fileURLToPath } from 'node:url';

/**
 * Calculator for very large numbers using BigInt
 */
class BigIntCalculator {
  /**
   * Calculate factorial of a large number
   */
  factorial(n: bigint): bigint {
    if (n <= 1n) return 1n;
    let result = 1n;
    for (let i = 2n; i <= n; i++) {
      result *= i;
    }
    return result;
  }

  /**
   * Calculate Fibonacci number at position n
   */
  fibonacci(n: bigint): bigint {
    if (n <= 1n) return n;
    let prev = 0n;
    let curr = 1n;
    for (let i = 2n; i <= n; i++) {
      const next = prev + curr;
      prev = curr;
      curr = next;
    }
    return curr;
  }

  /**
   * Calculate power with large exponents
   */
  power(base: bigint, exponent: bigint): bigint {
    if (exponent === 0n) return 1n;
    let result = base;
    for (let i = 1n; i < exponent; i++) {
      result *= base;
    }
    return result;
  }

  /**
   * Get nanosecond timestamp as BigInt
   */
  getNanosTimestamp(): bigint {
    return BigInt(Date.now()) * 1000000n;
  }
}

async function main() {
  console.log('🔢 BigInt Calculations Example\n');

  // Create calculator with advanced serialization
  console.log('Creating BigIntCalculator with advanced serialization...');
  await using calculator = await procxy(BigIntCalculator, {
    modulePath: fileURLToPath(import.meta.url),
    serialization: 'advanced'
  });

  // Example 1: Calculate factorial
  console.log('\n📝 Example 1: Factorial of large numbers');
  const fact20 = await calculator.factorial(20n);
  console.log('20! =', fact20);
  console.log('Digits:', fact20.toString().length);

  const fact100 = await calculator.factorial(100n);
  console.log('\n100! has', fact100.toString().length, 'digits');
  console.log('First 50 digits:', fact100.toString().slice(0, 50) + '...');

  // Example 2: Fibonacci numbers
  console.log('\n📝 Example 2: Fibonacci sequence');
  const fib50 = await calculator.fibonacci(50n);
  console.log('Fibonacci(50) =', fib50);

  const fib100 = await calculator.fibonacci(100n);
  console.log('Fibonacci(100) =', fib100);
  console.log('Digits:', fib100.toString().length);

  // Example 3: Power calculations
  console.log('\n📝 Example 3: Power calculations');
  const power = await calculator.power(2n, 100n);
  console.log('2^100 =', power);
  console.log('Digits:', power.toString().length);

  // Example 4: Nanosecond timestamp
  console.log('\n📝 Example 4: High-precision timestamp');
  const nanos = await calculator.getNanosTimestamp();
  console.log('Current nanosecond timestamp:', nanos);
  console.log('Milliseconds:', BigInt(Date.now()));

  console.log('\n✅ BigInt calculations completed successfully!');
  console.log('\n💡 Try these with JSON mode - they would fail!');
  console.log('   JSON.stringify(10n) throws "TypeError: Do not know how to serialize a BigInt"');
}

// Run the example
main().catch(console.error);
