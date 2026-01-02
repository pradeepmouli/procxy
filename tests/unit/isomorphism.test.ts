import { describe, it, expectTypeOf } from 'vitest';
import type { Procxy } from '../../src/types/procxy.js';
import type {
  UnwrapProcxy,
  IsProcxy,
  GetProcxyMode,
  HasHandleSupport,
  ChangeProcxyMode,
  ToggleProcxyHandles,
  ProcxyIsomorphism,
  VerifyIsomorphism,
  GetProcxyMethods,
  GetProcxyLifecycleMethods,
  MaybeProxy
} from '../../src/types/isomorphism.js';

// Test classes
class Calculator {
  add(a: number, b: number): number {
    return a + b;
  }

  subtract(a: number, b: number): number {
    return a - b;
  }

  private secret(): void {}
}

class BufferProcessor {
  process(buffer: Buffer): Buffer {
    return buffer;
  }
}

describe('Isomorphism Type Utilities', () => {
  describe('UnwrapProcxy', () => {
    it('should extract T from Procxy<T>', () => {
      type ProxiedCalc = Procxy<Calculator>;
      type Unwrapped = UnwrapProcxy<ProxiedCalc>;

      expectTypeOf<Unwrapped>().toEqualTypeOf<Calculator>();
    });

    it('should extract T from Procxy<T, "advanced">', () => {
      type ProxiedProc = Procxy<BufferProcessor, 'advanced'>;
      type Unwrapped = UnwrapProcxy<ProxiedProc>;

      expectTypeOf<Unwrapped>().toEqualTypeOf<BufferProcessor>();
    });

    it('should extract T from Procxy<T, Mode, true>', () => {
      type ProxiedWithHandles = Procxy<Calculator, 'json', true>;
      type Unwrapped = UnwrapProcxy<ProxiedWithHandles>;

      expectTypeOf<Unwrapped>().toEqualTypeOf<Calculator>();
    });

    it('should return never for non-Procxy types', () => {
      type NotProcxy = UnwrapProcxy<Calculator>;

      expectTypeOf<NotProcxy>().toEqualTypeOf<never>();
    });
  });

  describe('IsProcxy', () => {
    it('should return true for Procxy types', () => {
      type Check = IsProcxy<Procxy<Calculator>>;

      expectTypeOf<Check>().toEqualTypeOf<true>();
    });

    it('should return false for non-Procxy types', () => {
      type Check = IsProcxy<Calculator>;

      expectTypeOf<Check>().toEqualTypeOf<false>();
    });
  });

  describe('GetProcxyMode', () => {
    it('should extract json mode', () => {
      type Mode = GetProcxyMode<Procxy<Calculator, 'json'>>;

      expectTypeOf<Mode>().toEqualTypeOf<'json'>();
    });

    it('should extract advanced mode', () => {
      type Mode = GetProcxyMode<Procxy<BufferProcessor, 'advanced'>>;

      expectTypeOf<Mode>().toEqualTypeOf<'advanced'>();
    });
  });

  describe('HasHandleSupport', () => {
    it('should return true when handles are supported', () => {
      type Has = HasHandleSupport<Procxy<Calculator, 'advanced', true>>;

      expectTypeOf<Has>().toEqualTypeOf<true>();
    });

    it('should return false when handles are not supported', () => {
      type Has = HasHandleSupport<Procxy<Calculator, 'json', false>>;

      expectTypeOf<Has>().toEqualTypeOf<false>();
    });
  });

  describe('ChangeProcxyMode', () => {
    it('should change json to advanced mode', () => {
      type JsonProxy = Procxy<Calculator, 'json'>;
      type AdvancedProxy = ChangeProcxyMode<JsonProxy, 'advanced'>;

      expectTypeOf<AdvancedProxy>().toEqualTypeOf<Procxy<Calculator, 'advanced', false>>();
    });

    it('should preserve handle support when changing mode', () => {
      type JsonWithHandles = Procxy<Calculator, 'json', true>;
      type AdvancedWithHandles = ChangeProcxyMode<JsonWithHandles, 'advanced'>;

      expectTypeOf<AdvancedWithHandles>().toEqualTypeOf<Procxy<Calculator, 'advanced', true>>();
    });
  });

  describe('ToggleProcxyHandles', () => {
    it('should enable handle support', () => {
      type NoHandles = Procxy<Calculator, 'advanced', false>;
      type WithHandles = ToggleProcxyHandles<NoHandles, true>;

      expectTypeOf<WithHandles>().toEqualTypeOf<Procxy<Calculator, 'advanced', true>>();
    });

    it('should disable handle support', () => {
      type WithHandles = Procxy<Calculator, 'advanced', true>;
      type NoHandles = ToggleProcxyHandles<WithHandles, false>;

      expectTypeOf<NoHandles>().toEqualTypeOf<Procxy<Calculator, 'advanced', false>>();
    });
  });

  describe('ProcxyIsomorphism', () => {
    it('should provide forward mapping T → Procxy<T>', () => {
      type Iso = ProcxyIsomorphism<Calculator>;
      type Forward = Iso['forward'];

      expectTypeOf<Forward>().toEqualTypeOf<Procxy<Calculator, 'json', false>>();
    });

    it('should provide backward mapping', () => {
      type Iso = ProcxyIsomorphism<Calculator>;
      type Backward = Iso['backward'];

      expectTypeOf<Backward>().toEqualTypeOf<Calculator>();
    });

    it('should work with different modes', () => {
      type Iso = ProcxyIsomorphism<BufferProcessor, 'advanced', true>;
      type Forward = Iso['forward'];

      expectTypeOf<Forward>().toEqualTypeOf<Procxy<BufferProcessor, 'advanced', true>>();
    });
  });

  describe('VerifyIsomorphism', () => {
    it('should verify isomorphism holds', () => {
      type Verified = VerifyIsomorphism<Calculator>;

      expectTypeOf<Verified>().toEqualTypeOf<Calculator>();
    });

    it('should verify for advanced mode', () => {
      type Verified = VerifyIsomorphism<BufferProcessor, 'advanced'>;

      expectTypeOf<Verified>().toEqualTypeOf<BufferProcessor>();
    });

    it('should verify with handle support', () => {
      type Verified = VerifyIsomorphism<Calculator, 'json', true>;

      expectTypeOf<Verified>().toEqualTypeOf<Calculator>();
    });
  });

  describe('GetProcxyMethods', () => {
    it('should extract method names', () => {
      type Methods = GetProcxyMethods<Procxy<Calculator>>;

      // Methods should include regular methods like 'add' and 'subtract'
      // Check that at least one expected method is in the union
      expectTypeOf<'add'>().toMatchTypeOf<Methods>();
      expectTypeOf<'subtract'>().toMatchTypeOf<Methods>();
    });

    it('should exclude lifecycle methods', () => {
      type Methods = GetProcxyMethods<Procxy<Calculator>>;

      // These should NOT be in Methods (they're lifecycle methods)
      expectTypeOf<Methods>().not.toMatchTypeOf<'$terminate'>();
      expectTypeOf<Methods>().not.toMatchTypeOf<'$process'>();
    });
  });

  describe('GetProcxyLifecycleMethods', () => {
    it('should extract lifecycle methods', () => {
      type Lifecycle = GetProcxyLifecycleMethods<Procxy<Calculator>>;

      // Check that lifecycle methods are in the union
      expectTypeOf<'$terminate'>().toMatchTypeOf<Lifecycle>();
      expectTypeOf<'$process'>().toMatchTypeOf<Lifecycle>();
    });

    it('should include $sendHandle when handles are supported', () => {
      type Lifecycle = GetProcxyLifecycleMethods<Procxy<Calculator, 'advanced', true>>;

      // Check all lifecycle methods including handle support
      expectTypeOf<'$terminate'>().toMatchTypeOf<Lifecycle>();
      expectTypeOf<'$process'>().toMatchTypeOf<Lifecycle>();
      expectTypeOf<'$sendHandle'>().toMatchTypeOf<Lifecycle>();
    });

    it('should not include $sendHandle when handles are not supported', () => {
      type Lifecycle = GetProcxyLifecycleMethods<Procxy<Calculator, 'json', false>>;

      expectTypeOf<'$terminate'>().toMatchTypeOf<Lifecycle>();
      expectTypeOf<'$process'>().toMatchTypeOf<Lifecycle>();
      // $sendHandle should not be assignable to Lifecycle
      expectTypeOf<'$sendHandle'>().not.toMatchTypeOf<Lifecycle>();
    });
  });

  describe('Round-trip isomorphism', () => {
    it('should maintain type through forward and backward', () => {
      type Original = Calculator;
      type Forward = Procxy<Original>;
      type Backward = UnwrapProcxy<Forward>;

      expectTypeOf<Backward>().toEqualTypeOf<Original>();
    });

    it('should work with complex configurations', () => {
      type Original = BufferProcessor;
      type Forward = Procxy<Original, 'advanced', true>;
      type Backward = UnwrapProcxy<Forward>;

      expectTypeOf<Backward>().toEqualTypeOf<Original>();
    });
  });

  describe('MaybeProxy', () => {
    it('should accept both Procxy and concrete instances', () => {
      type Maybe = MaybeProxy<Calculator>;

      expectTypeOf<Procxy<Calculator>>().toMatchTypeOf<Maybe>();
      expectTypeOf<Calculator>().toMatchTypeOf<Maybe>();
    });

    it('should expose common user methods', () => {
      type MaybeAdd = MaybeProxy<Calculator>['add'];
      type MaybeSubtract = MaybeProxy<Calculator>['subtract'];

      expectTypeOf<MaybeAdd>().toMatchTypeOf<(a: number, b: number) => number | Promise<number>>();
      expectTypeOf<MaybeSubtract>().toMatchTypeOf<
        (a: number, b: number) => number | Promise<number>
      >();
    });

    it('should not expose Procxy-only lifecycle methods', () => {
      type Maybe = MaybeProxy<Calculator>;

      expectTypeOf<Maybe>().not.toMatchTypeOf<{ $terminate(): Promise<void> }>();
      expectTypeOf<Maybe>().not.toMatchTypeOf<{ $process: unknown }>();
    });
  });
});
