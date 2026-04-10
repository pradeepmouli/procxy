# Functions

## procxy

### `procxy`
Create a proxy for a remote object instance running in a child process.

This function spawns a child process via `fork()`, instantiates the specified class
in that child, and returns a proxy object that transparently forwards method calls
over IPC. All methods become async and return Promises.
```ts
procxy<T, C, M, SH>(className: keyof T, modulePathOrOptions?: string | ProcxyOptions<M, SH>, options?: ProcxyOptions<M, SH>, constructorArgs: T[keyof T] extends Constructor<any> ? ValidateProcxiable<any, M>[] : never): Promise<T[C] extends Constructor<U> ? Procxy<U, M, SH> : never>
```
**Parameters:**
- `className: keyof T`
- `modulePathOrOptions: string | ProcxyOptions<M, SH>` (optional)
- `options: ProcxyOptions<M, SH>` (optional) — Optional ProcxyOptions for process configuration
- `constructorArgs: T[keyof T] extends Constructor<any> ? ValidateProcxiable<any, M>[] : never` — Constructor arguments (must be JSON-serializable)
**Returns:** `Promise<T[C] extends Constructor<U> ? Procxy<U, M, SH> : never>` — A Promise that resolves to a Procxy<T> proxy object
**Throws:** If constructor arguments are not JSON-serializable (FR-019, FR-022)
**See:** - Procxy for the proxy type definition
 - ProcxyOptions for available configuration options
 - https://github.com/pradeepmouli/procxy#readme | Procxy Documentation
**Overloads:**
```ts
procxy<T, M, SH>(Class: Constructor<T>, modulePath: string, options: ProcxyOptions<M, SH>, constructorArgs: ValidateProcxiable<any, M>[]): Promise<Procxy<T, M, SH>>
```
```ts
procxy<T, M, SH>(Class: Constructor<T>, options: ProcxyOptions<M, SH>, constructorArgs: ValidateProcxiable<any, M>[]): Promise<Procxy<T, M, SH>>
```
```ts
procxy<T, M, SH>(Class: Constructor<T>, modulePath: string, constructorArgs: ValidateProcxiable<any, M>[]): Promise<Procxy<T, M, SH>>
```
```ts
procxy<T, M, SH>(Class: Constructor<T>, constructorArgs: ValidateProcxiable<any, M>[]): Promise<Procxy<T, M, SH>>
```
```typescript
import { procxy } from 'procxy';

// Basic usage - no constructor args
class Calculator {
  add(a: number, b: number): number {
    return a + b;
  }
}

const calc = await procxy(Calculator, './calculator.js');
const result = await calc.add(5, 7); // 12
await calc.$terminate(); // Clean up
```
```typescript
// With constructor arguments
class Worker {
  constructor(public name: string, public threads: number) {}

  async process(data: string[]): Promise<string[]> {
    // Heavy processing in child process
    return data.map(s => s.toUpperCase());
  }
}

const worker = await procxy(Worker, './worker.js', undefined, 'MyWorker', 4);
const result = await worker.process(['hello', 'world']);
await worker.$terminate();
```
```typescript
// With options (timeout, retries, custom env)
const worker = await procxy(
  Worker,
  './worker.js',       // Module path is required
  {
    timeout: 60000,      // 60s timeout per method call
    retries: 5,          // Retry failed calls 5 times
    cwd: '/tmp',         // Child process working directory
    env: {               // Custom environment variables
      NODE_ENV: 'production',
      API_KEY: process.env.API_KEY
    }
  },
  'MyWorker',            // Constructor arguments follow options
  4
);
```
```typescript
// Lifecycle management
const worker = await procxy(Worker, './worker.js');

// Access underlying child process
console.log('Child PID:', worker.$process.pid);

// Terminate when done
await worker.$terminate(); // Kills child and rejects pending calls
```

## serialization

### `sanitizeForV8`
Sanitize a value by converting to plain objects and removing non-V8-serializable properties.
Recursively processes objects, arrays, and nested structures.

This is useful for configuration objects that may contain functions,
class instances, or other non-serializable properties that aren't needed in the child process.
```ts
sanitizeForV8(value: unknown, seen: WeakSet<object>): any
```
**Parameters:**
- `value: unknown` — The value to sanitize
- `seen: WeakSet<object>` — default: `...`
**Returns:** `any` — A new value with all non-serializable properties removed
```typescript
const config = {
  data: 'hello',
  handler: () => {},  // Will be removed
  nested: {
    value: 42,
    method: () => {}  // Will be removed
  }
};

const sanitized = sanitizeForV8(config);
// Result: { data: 'hello', nested: { value: 42 } }
```

### `sanitizeForV8Array`
Sanitize an array of values by removing non-V8-serializable properties from each.
```ts
sanitizeForV8Array(values: unknown[], seen: WeakSet<object>): any[]
```
**Parameters:**
- `values: unknown[]` — Array of values to sanitize
- `seen: WeakSet<object>` — default: `...`
**Returns:** `any[]` — New array with sanitized values
```typescript
const args = [
  { config: true, handler: () => {} },
  { value: 42 }
];
const sanitized = sanitizeForV8Array(args);
// Result: [{ config: true }, { value: 42 }]
```

## isomorphism

### `isProcxy`
Runtime utilities for working with Procxy instances.

These functions provide runtime checks for Procxy instances:
- isProcxy: Check if a value is a Procxy instance
- isAdvancedMode: Check if a Procxy instance uses advanced serialization mode
- isHandleSupported: Check if a Procxy instance supports handle passing
```ts
isProcxy<T>(obj: MaybeProxy<T>): obj is Procxy<T, any, any>
```
**Parameters:**
- `obj: MaybeProxy<T>`
**Returns:** `obj is Procxy<T, any, any>`
```typescript
import { procxy, isProcxy, isAdvancedMode } from 'procxy';

const calc = await procxy(Calculator, './calculator.js');

if (isProcxy(calc)) {
  console.log('Is a Procxy instance');
}

if (isAdvancedMode(calc)) {
  console.log('Using advanced serialization');
}
```

### `isAdvancedMode`
Runtime utilities for working with Procxy instances.

These functions provide runtime checks for Procxy instances:
- isProcxy: Check if a value is a Procxy instance
- isAdvancedMode: Check if a Procxy instance uses advanced serialization mode
- isHandleSupported: Check if a Procxy instance supports handle passing
```ts
isAdvancedMode<T, H>(proxy: Procxy<T, any, H>): proxy is Procxy<T, "advanced", H>
```
**Parameters:**
- `proxy: Procxy<T, any, H>`
**Returns:** `proxy is Procxy<T, "advanced", H>`
```typescript
import { procxy, isProcxy, isAdvancedMode } from 'procxy';

const calc = await procxy(Calculator, './calculator.js');

if (isProcxy(calc)) {
  console.log('Is a Procxy instance');
}

if (isAdvancedMode(calc)) {
  console.log('Using advanced serialization');
}
```

### `isHandleSupported`
Runtime utilities for working with Procxy instances.

These functions provide runtime checks for Procxy instances:
- isProcxy: Check if a value is a Procxy instance
- isAdvancedMode: Check if a Procxy instance uses advanced serialization mode
- isHandleSupported: Check if a Procxy instance supports handle passing
```ts
isHandleSupported<T, H>(proxy: Procxy<T, any, H>): proxy is Procxy<T, "advanced", true>
```
**Parameters:**
- `proxy: Procxy<T, any, H>`
**Returns:** `proxy is Procxy<T, "advanced", true>`
```typescript
import { procxy, isProcxy, isAdvancedMode } from 'procxy';

const calc = await procxy(Calculator, './calculator.js');

if (isProcxy(calc)) {
  console.log('Is a Procxy instance');
}

if (isAdvancedMode(calc)) {
  console.log('Using advanced serialization');
}
```
