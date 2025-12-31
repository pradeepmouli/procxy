import { describe, it, expect, afterEach } from 'vitest';
import { procxy } from '../../src/index.js';
import type { Procxy } from '../../src/types/procxy.js';
import { resolve } from 'node:path';

// Simple test class
class SimpleV8Test {
  echoBuffer(buf: Buffer): Buffer {
    return buf;
  }

  echoBigInt(n: bigint): bigint {
    return n;
  }
}

const testPath = resolve(process.cwd(), 'tests/integration/v8-simple.test.ts');

describe('Simple V8 Serialization Test', () => {
  let proxy: Procxy<SimpleV8Test, 'advanced'> | undefined;

  afterEach(async () => {
    if (proxy) {
      await proxy.$terminate();
      proxy = undefined;
    }
  });

  it('should echo Buffer', async () => {
    const TestClass = SimpleV8Test;
    proxy = await procxy(TestClass, testPath, { serialization: 'advanced' });

    const input = Buffer.from([1, 2, 3]);
    console.log('Input:', input);
    console.log('Input constructor:', input.constructor.name);
    console.log('Is Buffer:', Buffer.isBuffer(input));
    console.log('Is Uint8Array:', input instanceof Uint8Array);

    const result = await proxy.echoBuffer(input);
    console.log('Result:', result);
    console.log('Result type:', typeof result);
    console.log('Result constructor:', result?.constructor?.name);
    console.log('Is Buffer:', Buffer.isBuffer(result));
    console.log('Is Uint8Array:', result instanceof Uint8Array);
    console.log('Result keys:', Object.keys(result));

    // V8 structured clone might deserialize Buffer as a plain object
    // Try converting it back
    if (!Buffer.isBuffer(result) && typeof result === 'object' && result !== null) {
      const values = Object.values(result as any);
      if (values.every((v) => typeof v === 'number')) {
        const converted = Buffer.from(values as number[]);
        console.log('Converted:', converted);
        console.log('Converted is Buffer:', Buffer.isBuffer(converted));
      }
    }

    expect(Buffer.isBuffer(result) || result instanceof Uint8Array).toBe(true);
  });

  it('should echo BigInt', async () => {
    const TestClass = SimpleV8Test;
    proxy = await procxy(TestClass, testPath, { serialization: 'advanced' });

    const input = BigInt(123);
    const result = await proxy.echoBigInt(input);

    expect(typeof result).toBe('bigint');
    expect(result).toBe(input);
  });
});

// Export the class so it can be imported
export { SimpleV8Test };
