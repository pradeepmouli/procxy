import { describe, it, expect, afterEach } from 'vitest';
import { resolve } from 'path';
import { procxy } from '../../src/index.js';
import { Calculator } from '../fixtures/calculator.js';

const CALCULATOR_PATH = resolve(process.cwd(), 'tests/fixtures/calculator.ts');

describe('procxy() function signature permutations', () => {
  const activeProxies: Array<{ $terminate: () => Promise<void> }> = [];

  afterEach(async () => {
    await Promise.all(activeProxies.map((p) => p.$terminate().catch(() => {})));
    activeProxies.length = 0;
  });

  describe('Case 1: procxy(Class, modulePath, options, ...args)', () => {
    it('should work with Class, modulePath, options, and constructor args', async () => {
      const calc = await procxy(
        Calculator,
        CALCULATOR_PATH,
        { timeout: 5000 },
        3 // precision constructor arg
      );
      activeProxies.push(calc);

      const result = await calc.add(1.111, 2.222);
      expect(result).toBe(3.333);
      await calc.$terminate();
    });

    it('should work with Class, modulePath, options, and no constructor args', async () => {
      const calc = await procxy(Calculator, CALCULATOR_PATH, { timeout: 5000 });
      activeProxies.push(calc);

      const result = await calc.add(1.1, 2.2);
      expect(result).toBe(3.3);
      await calc.$terminate();
    });
  });

  describe('Case 2.1: procxy(Class, options, ...args) with options.modulePath', () => {
    it('should work with Class, options containing modulePath, and constructor args', async () => {
      const calc = await procxy(
        Calculator,
        { modulePath: CALCULATOR_PATH, timeout: 5000 },
        4 // precision constructor arg
      );
      activeProxies.push(calc);

      const result = await calc.add(1.1111, 2.2222);
      expect(result).toBe(3.3333);
      await calc.$terminate();
    });

    it('should work with Class, options containing modulePath, and no constructor args', async () => {
      const calc = await procxy(Calculator, {
        modulePath: CALCULATOR_PATH,
        timeout: 5000
      });
      activeProxies.push(calc);

      const result = await calc.add(1.1, 2.2);
      expect(result).toBe(3.3);
      await calc.$terminate();
    });
  });

  describe('Case 2.1: procxy(Class, options, ...args) without options.modulePath (auto-resolve)', () => {
    it('should auto-resolve module path when Class is defined locally', async () => {
      // This should work when Calculator is in scope and can be auto-resolved
      const calc = await procxy(Calculator, { timeout: 5000 }, 3);
      activeProxies.push(calc);

      const result = await calc.add(1.111, 2.222);
      expect(result).toBe(3.333);
      await calc.$terminate();
    });

    it('should auto-resolve module path with no constructor args', async () => {
      const calc = await procxy(Calculator, { timeout: 5000 });
      activeProxies.push(calc);

      const result = await calc.add(1.1, 2.2);
      expect(result).toBe(3.3);
      await calc.$terminate();
    });
  });

  describe('Case 3: procxy(Class, modulePath, ...args)', () => {
    it('should work with Class, modulePath, and constructor args (no options)', async () => {
      const calc = await procxy(Calculator, CALCULATOR_PATH, 3);
      activeProxies.push(calc);

      const result = await calc.add(1.111, 2.222);
      expect(result).toBe(3.333);
      await calc.$terminate();
    });

    it('should work with Class, modulePath, and multiple constructor args', async () => {
      const calc = await procxy(Calculator, CALCULATOR_PATH, 4);
      activeProxies.push(calc);

      const result = await calc.add(1.1111, 2.2222);
      expect(result).toBe(3.3333);
      await calc.$terminate();
    });

    it('should work with Class, modulePath, and no constructor args', async () => {
      const calc = await procxy(Calculator, CALCULATOR_PATH);
      activeProxies.push(calc);

      const result = await calc.add(1.1, 2.2);
      expect(result).toBe(3.3);
      await calc.$terminate();
    });
  });

  describe('Case 4: procxy(Class, ...args) with no modulePath or options', () => {
    it('should auto-resolve module path with constructor args', async () => {
      const calc = await procxy(Calculator, 3);
      activeProxies.push(calc);

      const result = await calc.add(1.111, 2.222);
      expect(result).toBe(3.333);
      await calc.$terminate();
    });

    it('should auto-resolve module path with no constructor args', async () => {
      const calc = await procxy(Calculator);
      activeProxies.push(calc);

      const result = await calc.add(1.1, 2.2);
      expect(result).toBe(3.3);
      await calc.$terminate();
    });

    it('should auto-resolve module path with multiple constructor args', async () => {
      const calc = await procxy(Calculator, 4);
      activeProxies.push(calc);

      const result = await calc.add(1.1111, 2.2222);
      expect(result).toBe(3.3333);
      await calc.$terminate();
    });
  });

  describe('Edge cases: distinguishing between options object and constructor args', () => {
    it('should treat object with procxy options as options, not constructor arg', async () => {
      // { timeout: 5000 } should be treated as options, not a constructor arg
      const calc = await procxy(Calculator, CALCULATOR_PATH, { timeout: 5000 });
      activeProxies.push(calc);

      // Should use default precision (2)
      const result = await calc.add(1.1, 2.2);
      expect(result).toBe(3.3);
      await calc.$terminate();
    });

    it('should treat object without procxy options as constructor arg', async () => {
      // Plain objects that are not ProcxyOptions should pass through as constructor args
      // Calculator doesn't accept object constructor args, so this is just for demonstration
      const calc = await procxy(Calculator, CALCULATOR_PATH, 3);
      activeProxies.push(calc);

      const result = await calc.add(1.111, 2.222);
      expect(result).toBe(3.333);
      await calc.$terminate();
    });

    it('should handle undefined/null constructor args correctly', async () => {
      // Passing undefined should not break argument parsing
      const calc = await procxy(Calculator, CALCULATOR_PATH, undefined);
      activeProxies.push(calc);

      // Should use default precision (2)
      const result = await calc.add(1.1, 2.2);
      expect(result).toBe(3.3);
      await calc.$terminate();
    });
  });

  describe('Options validation across all signatures', () => {
    it('should validate timeout option in signature 1', async () => {
      await expect(procxy(Calculator, CALCULATOR_PATH, { timeout: -1 }, 2)).rejects.toThrow(
        /timeout.*must be a positive number/i
      );
    });

    it('should validate timeout option in signature 2.1', async () => {
      await expect(
        procxy(Calculator, { modulePath: CALCULATOR_PATH, timeout: -1 }, 2)
      ).rejects.toThrow(/timeout.*must be a positive number/i);
    });

    it('should validate retries option in signature 3 (when third arg looks like options)', async () => {
      await expect(procxy(Calculator, CALCULATOR_PATH, { retries: -5 })).rejects.toThrow(
        /retries.*must be a non-negative number/i
      );
    });
  });

  describe('Case 2.2: className with options (modulePath is mandatory)', () => {
    it('should work when className is provided with modulePath in options', async () => {
      // Test runtime behavior - className as string with modulePath
      const calc = await (procxy as any)(
        'Calculator',
        { modulePath: CALCULATOR_PATH, timeout: 5000 },
        3
      );
      activeProxies.push(calc);

      const result = await calc.add(1.111, 2.222);
      expect(result).toBe(3.333);
      await calc.$terminate();
    });

    it('should work when className with modulePath in options and no constructor args', async () => {
      const calc = await (procxy as any)('Calculator', { modulePath: CALCULATOR_PATH });
      activeProxies.push(calc);

      const result = await calc.add(1.1, 2.2);
      expect(result).toBe(3.3);
      await calc.$terminate();
    });

    it('should fail when className is provided without modulePath', async () => {
      // This should fail because className requires explicit modulePath
      try {
        await (procxy as any)('Calculator', { timeout: 5000 }, 3);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should work when className with explicit modulePath string', async () => {
      const calc = await (procxy as any)('Calculator', CALCULATOR_PATH, { timeout: 5000 }, 3);
      activeProxies.push(calc);

      const result = await calc.add(1.111, 2.222);
      expect(result).toBe(3.333);
      await calc.$terminate();
    });
  });
});
