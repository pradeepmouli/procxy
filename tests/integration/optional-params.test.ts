import { describe, it, expect, afterEach } from 'vitest';
import { procxy } from '../../src/index.js';
import type { Procxy } from '../../src/types/procxy.js';
import { Greeter } from '../fixtures/greeter.js';
import { join } from 'path';

const __dirname = join(process.cwd(), 'tests', 'integration');

type test = Parameters<typeof Greeter.prototype.greet>;

describe('Optional Parameters', () => {
  let proxy: Procxy<Greeter> | null = null;

  afterEach(async () => {
    if (proxy) {
      await proxy.$terminate();
      proxy = null;
    }
  });

  it('should work with optional parameters - both provided', async () => {
    const greeterPath = join(__dirname, '../fixtures/greeter.ts');
    proxy = await procxy(Greeter, greeterPath);

    const result = await proxy.greet('World', 'Hi');
    expect(result).toBe('Hi, World');
  });

  it('should work with optional parameters - optional omitted', async () => {
    const greeterPath = join(__dirname, '../fixtures/greeter.ts');
    proxy = await procxy(Greeter, greeterPath);

    const result = await proxy.greet('World');
    expect(result).toBe('Hello, World');
  });

  it('should work with multiple optional parameters', async () => {
    const greeterPath = join(__dirname, '../fixtures/greeter.ts');
    proxy = await procxy(Greeter, greeterPath);

    // All provided
    let result = await proxy.greetMultiple('Alice', 'Hey', '!');
    expect(result).toBe('Hey, Alice!');

    // Only first optional
    result = await proxy.greetMultiple('Bob', 'Hi');
    expect(result).toBe('Hi, Bob.');

    // No optionals
    result = await proxy.greetMultiple('Charlie');
    expect(result).toBe('Hello, Charlie.');
  });

  it('should work with optional parameter in the middle', async () => {
    const greeterPath = join(__dirname, '../fixtures/greeter.ts');
    proxy = await procxy(Greeter, greeterPath);

    // All provided
    let result = await proxy.formatMessage('Alice', 'urgent', '!');
    expect(result).toBe('[URGENT] Alice!');

    // Optional omitted (undefined will be passed)
    result = await proxy.formatMessage('Bob', undefined, '?');
    expect(result).toBe('[INFO] Bob?');
  });
});
