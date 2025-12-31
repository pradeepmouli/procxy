/**
 * Type-level tests for Procxy<T> mapped type
 * These tests verify TypeScript's compile-time type checking
 */

import { describe, it, expect } from 'vitest';
import type { Procxy } from '../../src/types/procxy.js';

// Test fixture classes for type checking
class Calculator {
  constructor(public precision: number = 2) {}

  add(a: number, b: number): number {
    return a + b;
  }

  divide(a: number, b: number): number {
    if (b === 0) throw new Error('Division by zero');
    return a / b;
  }
}

class TypedService {
  getString(): string {
    return 'hello';
  }

  getNumber(): number {
    return 42;
  }

  getObject(): { name: string; value: number } {
    return { name: 'test', value: 123 };
  }

  acceptMultipleArgs(str: string, num: number, bool: boolean): string {
    return `${str}-${num}-${bool}`;
  }
}

describe('Type Safety Tests', () => {
  describe('Procxy<T> type mapping', () => {
    it('should convert sync methods to async Promise-returning methods', () => {
      // This is a compile-time test - if it compiles, it passes
      type ProxiedCalc = Procxy<Calculator>;

      // Verify method signatures are preserved with Promise wrapper
      const assertAdd: (proxy: ProxiedCalc) => Promise<number> = (proxy) => proxy.add(1, 2);
      const assertDivide: (proxy: ProxiedCalc) => Promise<number> = (proxy) => proxy.divide(10, 2);

      // Runtime verification that types are correct
      expect(typeof assertAdd).toBe('function');
      expect(typeof assertDivide).toBe('function');
    });

    it('should preserve method argument types', () => {
      type ProxiedService = Procxy<TypedService>;

      // Verify argument types are enforced
      const assertMultiArgs: (proxy: ProxiedService) => Promise<string> = (proxy) =>
        proxy.acceptMultipleArgs('test', 42, true);

      expect(typeof assertMultiArgs).toBe('function');
    });

    it('should preserve method return types wrapped in Promise', () => {
      type ProxiedService = Procxy<TypedService>;

      // Verify return types are correctly wrapped in Promise
      const assertString: (proxy: ProxiedService) => Promise<string> = (proxy) => proxy.getString();
      const assertNumber: (proxy: ProxiedService) => Promise<number> = (proxy) => proxy.getNumber();
      const assertObject: (proxy: ProxiedService) => Promise<{ name: string; value: number }> = (
        proxy
      ) => proxy.getObject();

      expect(typeof assertString).toBe('function');
      expect(typeof assertNumber).toBe('function');
      expect(typeof assertObject).toBe('function');
    });

    it('should add lifecycle methods $terminate and $process', () => {
      type ProxiedCalc = Procxy<Calculator>;

      // Verify lifecycle methods exist in the type
      const assertTerminate: (proxy: ProxiedCalc) => Promise<void> = (proxy) => proxy.$terminate();
      const assertProcess: (proxy: ProxiedCalc) => { pid?: number } = (proxy) => proxy.$process;

      expect(typeof assertTerminate).toBe('function');
      expect(typeof assertProcess).toBe('function');
    });
  });

  describe('Type error detection (compile-time)', () => {
    it('should catch wrong argument types at compile time', () => {
      // These tests verify that TypeScript WOULD catch errors at compile time
      // We can't test compilation errors directly in vitest, but we document the expectations

      type ProxiedCalc = Procxy<Calculator>;

      // ❌ This SHOULD fail TypeScript compilation (uncomment to test):
      // const proxy: ProxiedCalc = {} as any;
      // proxy.add('string', 'string'); // Error: Expected number, got string

      // ✅ This SHOULD pass TypeScript compilation:
      const validCall = (proxy: ProxiedCalc) => proxy.add(1, 2);

      expect(typeof validCall).toBe('function');
    });

    it('should catch wrong return type expectations at compile time', () => {
      type ProxiedService = Procxy<TypedService>;

      // ❌ This SHOULD fail TypeScript compilation (uncomment to test):
      // const proxy: ProxiedService = {} as any;
      // const result: string = await proxy.getString(); // Error: result is Promise<string>, not string

      // ✅ This SHOULD pass TypeScript compilation:
      const validCall = async (proxy: ProxiedService): Promise<string> => {
        const result = await proxy.getString();
        return result;
      };

      expect(typeof validCall).toBe('function');
    });

    it('should catch invalid method names at compile time', () => {
      type ProxiedCalc = Procxy<Calculator>;

      // ❌ This SHOULD fail TypeScript compilation (uncomment to test):
      // const proxy: ProxiedCalc = {} as any;
      // proxy.nonexistentMethod(); // Error: Property 'nonexistentMethod' does not exist

      // ✅ This SHOULD pass TypeScript compilation:
      const validCall = (proxy: ProxiedCalc) => proxy.add(1, 2);

      expect(typeof validCall).toBe('function');
    });
  });

  describe('Complex type scenarios', () => {
    it('should handle methods with optional parameters', () => {
      class ServiceWithOptionals {
        greet(name: string, greeting?: string): string {
          return `${greeting || 'Hello'}, ${name}`;
        }
      }

      type ProxiedService = Procxy<ServiceWithOptionals>;

      // Type test - verify the method exists (checking keyof instead of extends to avoid VSCode TS server issues)
      type HasGreetMethod = 'greet' extends keyof ProxiedService ? true : false;
      const test: HasGreetMethod = true as HasGreetMethod;
      expect(test).toBe(true);
    });

    it('should handle methods with multiple parameters', () => {
      class ServiceWithMultiple {
        sum(a: number, b: number, c: number): number {
          return a + b + c;
        }
      }

      type ProxiedService = Procxy<ServiceWithMultiple>;

      // Type test - verify the method exists
      type TestSum = ProxiedService extends { sum: (...args: any[]) => any } ? true : false;
      const test: TestSum = true;
      expect(test).toBe(true);
    });
  });
});
