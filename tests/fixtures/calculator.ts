/**
 * Test fixture: Simple calculator with basic synchronous methods.
 * Used for US1 (Basic Remote Method Invocation) tests.
 */
export class Calculator {
  constructor(private precision: number = 2) {}

  /**
   * Add two numbers.
   */
  add(a: number, b: number): number {
    return Math.round((a + b) * 10 ** this.precision) / 10 ** this.precision;
  }

  /**
   * Subtract two numbers.
   */
  subtract(a: number, b: number): number {
    return Math.round((a - b) * 10 ** this.precision) / 10 ** this.precision;
  }

  /**
   * Multiply two numbers.
   */
  multiply(a: number, b: number): number {
    return Math.round(a * b * 10 ** this.precision) / 10 ** this.precision;
  }

  /**
   * Divide two numbers.
   */
  divide(a: number, b: number): number {
    if (b === 0) throw new Error('Division by zero');
    return Math.round((a / b) * 10 ** this.precision) / 10 ** this.precision;
  }

  /**
   * Get precision setting.
   */
  getPrecision(): number {
    return this.precision;
  }
}
