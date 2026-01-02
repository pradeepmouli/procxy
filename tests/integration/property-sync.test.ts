import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { procxy } from '../../src/index.js';
import { CircularJsonWorker } from '../fixtures/circular-json-worker.js';
import { PropertyWorker } from '../fixtures/property-worker.js';
import { ConstructorPropertyWorker } from '../fixtures/constructor-property-worker.js';
import { DefaultPropertyWorker } from '../fixtures/default-property-worker.js';

const propertyWorkerPath = resolve(process.cwd(), 'tests/fixtures/property-worker.ts');
const constructorPropertyWorkerPath = resolve(
  process.cwd(),
  'tests/fixtures/constructor-property-worker.ts'
);
const defaultPropertyWorkerPath = resolve(
  process.cwd(),
  'tests/fixtures/default-property-worker.ts'
);
const circularJsonWorkerPath = resolve(process.cwd(), 'tests/fixtures/circular-json-worker.ts');

describe('Property Synchronization', () => {
  it('should synchronize public property writes from child to parent', async () => {
    await using proxy = await procxy(PropertyWorker, propertyWorkerPath);
    // Initially counter is 0
    expect(await proxy.getCounter()).toBe(0);

    // Increment in child (writes to property)
    await proxy.incrementCounter();

    // Property change should be visible through getter
    expect(await proxy.getCounter()).toBe(1);
  });

  it('should synchronize property writes from child', async () => {
    await using proxy = await procxy(PropertyWorker, propertyWorkerPath);
    // Set name in child
    await proxy.setName('Alice');

    // Read it back
    expect(await proxy.getName()).toBe('Alice');
  });

  it('should support multiple property updates', async () => {
    await using proxy = await procxy(PropertyWorker, propertyWorkerPath);
    await proxy.setName('Bob');
    await proxy.incrementCounter();
    await proxy.incrementCounter();
    await proxy.incrementCounter();

    expect(await proxy.getName()).toBe('Bob');
    expect(await proxy.getCounter()).toBe(3);
  });

  it('should handle property getter/setter with transformation', async () => {
    await using proxy = await procxy(PropertyWorker, propertyWorkerPath);
    // The PropertyWorker doubles values when setting via setter
    await proxy.incrementCounter(); // counter = 1

    // Access through methods
    const counter = await proxy.getCounter();
    expect(counter).toBe(1);
  });

  it('should maintain property values across method calls', async () => {
    await using proxy = await procxy(PropertyWorker, propertyWorkerPath);
    await proxy.setName('Charlie');
    await proxy.incrementCounter();

    // Values should persist
    expect(await proxy.getName()).toBe('Charlie');
    expect(await proxy.getCounter()).toBe(1);

    await proxy.incrementCounter();
    expect(await proxy.getCounter()).toBe(2);
  });

  it('should allow parent to read properties synchronously', async () => {
    await using proxy = await procxy(PropertyWorker, propertyWorkerPath);
    // First, set a property from the child
    await proxy.setName('Diana');

    // Parent should be able to read it synchronously from property store
    expect(proxy.name).toBe('Diana');
  });

  it('should reject parent attempts to set properties', async () => {
    await using proxy = await procxy(PropertyWorker, propertyWorkerPath);
    // Parent cannot set properties - this should throw
    expect(() => {
      (proxy as any).counter = 5;
    }).toThrow(/Cannot set property/);
  });

  it('should synchronize property updates from child to parent', async () => {
    await using proxy = await procxy(PropertyWorker, propertyWorkerPath);
    // Child sets
    await proxy.setName('Frank');
    expect(proxy.name).toBe('Frank');

    // Child sets again
    await proxy.setName('Grace');
    expect(proxy.name).toBe('Grace');
  });

  it('should make constructor-set properties immediately available', async () => {
    await using proxy = await procxy(
      ConstructorPropertyWorker,
      constructorPropertyWorkerPath,
      'Alice',
      30,
      true
    );

    // Properties set in constructor should be immediately available (no method call needed)
    expect(proxy.name).toBe('Alice');
    expect(proxy.age).toBe(30);
    expect(proxy.active).toBe(true);
  });

  it('should track constructor-set properties for subsequent updates', async () => {
    await using proxy = await procxy(
      ConstructorPropertyWorker,
      constructorPropertyWorkerPath,
      'Bob',
      25
    );

    // Initial values from constructor
    expect(proxy.name).toBe('Bob');
    expect(proxy.age).toBe(25);

    // Update properties via methods
    await proxy.setName('Charlie');
    await proxy.incrementAge();
    await proxy.toggleActive();

    // Updated values should be synced
    expect(proxy.name).toBe('Charlie');
    expect(proxy.age).toBe(26);
    expect(proxy.active).toBe(false);
  });

  it('should sync class field initializers (default values)', async () => {
    await using proxy = await procxy(DefaultPropertyWorker, defaultPropertyWorkerPath);

    // Default values set at class field level should be immediately available
    expect(proxy.name).toBe('default-name');
    expect(proxy.counter).toBe(0);
    expect(proxy.enabled).toBe(true);
  });

  it('should sync class field initializers with constructor override', async () => {
    await using proxy = await procxy(
      DefaultPropertyWorker,
      defaultPropertyWorkerPath,
      'custom-name'
    );

    // Constructor overrides the default name
    expect(proxy.name).toBe('custom-name');
    // But other defaults are still set
    expect(proxy.counter).toBe(0);
    expect(proxy.enabled).toBe(true);
  });

  it('should track default-initialized properties for updates', async () => {
    await using proxy = await procxy(DefaultPropertyWorker, defaultPropertyWorkerPath);

    // Initial defaults
    expect(proxy.name).toBe('default-name');
    expect(proxy.counter).toBe(0);

    // Update via method
    await proxy.incrementCounter();

    // Updated value should be synced
    expect(proxy.counter).toBe(1);
  });

  it('should not forward property_set for private-like properties', async () => {
    await using proxy = await procxy(PropertyWorker, propertyWorkerPath);

    const { secret, cache } = await proxy.setPrivateState('token');
    expect(secret).toBe('token');
    expect(cache).toBe('cache:token');

    // Parent side should not see these private-like properties in its property store
    expect(typeof (proxy as any)._secret).toBe('function');
    expect(() => (proxy as any).$cache).toThrow();
  });

  it('should sanitize circular property updates in json serialization mode', async () => {
    await using proxy = await procxy(CircularJsonWorker, circularJsonWorkerPath, {
      serialization: 'json'
    });

    await proxy.setCircular();

    expect(proxy.payload).toEqual({ self: '[Circular]' });
  });
});
