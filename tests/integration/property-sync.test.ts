import { resolve } from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { procxy } from '../../src/index.js';
import type { Procxy } from '../../src/types/procxy.js';
import { PropertyWorker } from '../fixtures/property-worker.js';

const propertyWorkerPath = resolve(process.cwd(), 'tests/fixtures/property-worker.ts');

describe('Property Synchronization', () => {
  let proxy: Procxy<PropertyWorker>;

  beforeEach(async () => {
    proxy = await procxy(PropertyWorker, propertyWorkerPath);
  });

  afterEach(async () => {
    if (proxy) {
      await proxy.$terminate();
    }
  });

  it('should synchronize public property writes from child to parent', async () => {
    // Initially counter is 0
    expect(await proxy.getCounter()).toBe(0);

    // Increment in child (writes to property)
    await proxy.incrementCounter();

    // Property change should be visible through getter
    expect(await proxy.getCounter()).toBe(1);
  });

  it('should synchronize property writes from child', async () => {
    // Set name in child
    await proxy.setName('Alice');

    // Read it back
    expect(await proxy.getName()).toBe('Alice');
  });

  it('should support multiple property updates', async () => {
    await proxy.setName('Bob');
    await proxy.incrementCounter();
    await proxy.incrementCounter();
    await proxy.incrementCounter();

    expect(await proxy.getName()).toBe('Bob');
    expect(await proxy.getCounter()).toBe(3);
  });

  it('should handle property getter/setter with transformation', async () => {
    // The PropertyWorker doubles values when setting via setter
    await proxy.incrementCounter(); // counter = 1

    // Access through methods
    const counter = await proxy.getCounter();
    expect(counter).toBe(1);
  });

  it('should maintain property values across method calls', async () => {
    await proxy.setName('Charlie');
    await proxy.incrementCounter();

    // Values should persist
    expect(await proxy.getName()).toBe('Charlie');
    expect(await proxy.getCounter()).toBe(1);

    await proxy.incrementCounter();
    expect(await proxy.getCounter()).toBe(2);
  });

  it('should allow parent to read properties synchronously', async () => {
    // First, set a property from the child
    await proxy.setName('Diana');

    // Parent should be able to read it synchronously from property store
    expect(proxy.name).toBe('Diana');
  });

  it('should reject parent attempts to set properties', async () => {
    // Parent cannot set properties - this should throw
    expect(() => {
      (proxy as any).counter = 5;
    }).toThrow(/Cannot set property/);
  });

  it('should synchronize property updates from child to parent', async () => {
    // Child sets
    await proxy.setName('Frank');
    expect(proxy.name).toBe('Frank');

    // Child sets again
    await proxy.setName('Grace');
    expect(proxy.name).toBe('Grace');
  });
});
