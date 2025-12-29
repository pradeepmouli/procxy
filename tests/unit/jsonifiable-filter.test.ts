import { describe, it, expectTypeOf } from 'vitest';
import type { Procxy } from '../../src/types/procxy.js';
import { EventEmitter } from 'events';

describe('Procxy Type - Jsonifiable Filter', () => {
  it('should only include methods with Jsonifiable parameters and return values', () => {
    class TestClass {
      // Valid: primitive parameters and return
      validMethod(a: number, _b: string): number {
        return a;
      }

      // Valid: object parameters and return
      validObject(_obj: { x: number; y: string }): { result: boolean } {
        return { result: true };
      }

      // Valid: array parameters and return
      validArray(_items: number[]): string[] {
        return [];
      }

      // Valid: null and undefined as return
      validNull(): null {
        return null;
      }

      // Valid: void return (becomes undefined, which is Jsonifiable)
      validVoid(_x: number): void {}

      // Valid: Promise return
      async validAsync(_x: string): Promise<number> {
        return 42;
      }

      // Invalid: Function parameter (should be excluded)
      invalidFunctionParam(_fn: () => void): number {
        return 0;
      }

      // Invalid: Function return (should be excluded)
      invalidFunctionReturn(): () => void {
        return () => {};
      }

      // Invalid: Symbol parameter (should be excluded)
      invalidSymbol(_sym: symbol): number {
        return 0;
      }
    }

    type ProxyType = Procxy<TestClass>;

    // Valid methods should exist
    expectTypeOf<ProxyType>().toHaveProperty('validMethod');
    expectTypeOf<ProxyType>().toHaveProperty('validObject');
    expectTypeOf<ProxyType>().toHaveProperty('validArray');
    expectTypeOf<ProxyType>().toHaveProperty('validNull');
    expectTypeOf<ProxyType>().toHaveProperty('validVoid');
    expectTypeOf<ProxyType>().toHaveProperty('validAsync');

    // Check that the type doesn't have these properties (they should be filtered out)
    type HasInvalidMethod = 'invalidFunctionParam' extends keyof ProxyType ? true : false;
    type HasInvalidReturn = 'invalidFunctionReturn' extends keyof ProxyType ? true : false;
    type HasInvalidSymbol = 'invalidSymbol' extends keyof ProxyType ? true : false;

    expectTypeOf<HasInvalidMethod>().toEqualTypeOf<false>();
    expectTypeOf<HasInvalidReturn>().toEqualTypeOf<false>();
    expectTypeOf<HasInvalidSymbol>().toEqualTypeOf<false>();

    // All valid methods should return Promises
    expectTypeOf<ProxyType['validMethod']>().toMatchTypeOf<(a: number, _b: string) => Promise<number>>();
    expectTypeOf<ProxyType['validAsync']>().toMatchTypeOf<(_x: string) => Promise<number>>();
  });

  it('should include EventEmitter methods only when event parameters are Jsonifiable', () => {
    // Valid: EventEmitter with Jsonifiable event parameters (using array format)
    class ValidEventWorker extends EventEmitter {
      doWork(): number {
        return 42;
      }
    }

    type ValidProxyType = Procxy<ValidEventWorker>;

    // EventEmitter without type parameter should have event methods
    expectTypeOf<ValidProxyType>().toHaveProperty('on');
    expectTypeOf<ValidProxyType>().toHaveProperty('once');
    expectTypeOf<ValidProxyType>().toHaveProperty('off');
    expectTypeOf<ValidProxyType>().toHaveProperty('removeListener');

    // Should also have the regular method
    expectTypeOf<ValidProxyType>().toHaveProperty('doWork');
  });
});
