# Procxy 🚀

> **procxy** */ˈprɒk.si/* — Transparent and type-safe process-based proxy for class instances

[![npm version](https://img.shields.io/npm/v/procxy.svg)](https://www.npmjs.com/package/procxy)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Tests](https://img.shields.io/badge/tests-243%20passing-brightgreen.svg)](./tests)
[![Coverage](https://img.shields.io/badge/coverage->90%25-brightgreen.svg)](./coverage)
[![Performance](https://img.shields.io/badge/overhead-<10ms-blueviolet.svg)](./README.md#-performance)
[![GitHub Sponsors](https://img.shields.io/badge/Sponsor-%E2%9D%A4-pink.svg)](https://github.com/sponsors/pradeepmouli)

> ⚠️ **Alpha Release** - API may change. Please report issues and provide feedback!

Run class instances in isolated child processes while interacting with them as if they were local objects. All method calls become async and are transparently forwarded over IPC with full TypeScript support.

## ✨ Features

- **🎯 Type-Safe** - Full TypeScript support with IntelliSense autocomplete
- **🪄 Automagic Module Resolution** - Zero-config import path detection from your source code
- **⚡ Fast** - <10ms overhead per method call
- **🔄 Events & Callbacks** - Transparent EventEmitter forwarding and bidirectional callback support
- **🏠 Properties** - Read-only properties on parent, full read/write on child
- **🛡️ Error Handling** - Complete error propagation with stack traces
- **🧹 Lifecycle** - Automatic cleanup with disposable protocol (`using`/`await using`)
- **⚙️ Configurable** - Timeouts, retries, custom environment, working directory
- **📦 Zero Dependencies** - Minimal bundle size (<50KB)
- **🧪 Well Tested** - See above

## 📦 Installation

```bash
npm install procxy
```

```bash
pnpm add procxy
```

```bash
yarn add procxy
```

## 🚀 Quick Start

### Basic Usage

```typescript
import { procxy } from 'procxy';
import { Calculator } from './calculator.js';

// Automatic module path detection (recommended)
const calc = await procxy(Calculator);

// Call methods (now async!)
const sum = await calc.add(5, 3); // 8
const product = await calc.multiply(4, 7); // 28

// Clean up
await calc.$terminate();

// Or with explicit module path (needed for dynamic imports)
const calc2 = await procxy(Calculator, './calculator.js');
```

### Using Disposables (Recommended)

```typescript
import { Calculator } from './calculator.js';

// Automatic cleanup with await using
await using calc = await procxy(Calculator);
const result = await calc.add(5, 3);
// Automatically terminated when scope exits
```

### Constructor Arguments

```typescript
import { Worker } from './worker.js';

class Worker {
  constructor(public name: string, public threads: number) {}

  async process(data: string[]): Promise<string[]> {
    // Heavy processing in isolated process
    return data.map(s => s.toUpperCase());
  }
}

// Pass constructor arguments after options
const worker = await procxy(
  Worker,
  './worker.js',  // Can be omitted if Worker is imported
  undefined,      // options (or omit)
  'MyWorker',     // name argument
  4               // threads argument
);

const result = await worker.process(['hello', 'world']);
// ['HELLO', 'WORLD']

await worker.$terminate();
```

## 🪄 Automagic Module Resolution

One of procxy's most convenient features is **automatic module path detection**. You don't need to manually specify where your class is located—procxy figures it out by parsing your import statements at runtime.

### How It Works

When you call `procxy(MyClass)`, the library:

1. **Inspects the call stack** to find where `procxy()` was called
2. **Reads your source file** and parses import/require statements
3. **Matches the class name** to find the corresponding import path
4. **Resolves the absolute path** for the child process

```typescript
// Your code
import { Calculator } from './math/calculator.js';
import { DataProcessor } from '@myorg/data-processor';

// Just works! No modulePath needed
const calc = await procxy(Calculator);
const processor = await procxy(DataProcessor);
```

### Supported Import Styles

Procxy can detect module paths from:

```typescript
// ✅ ESM named imports
import { MyClass } from './path/to/module.js';

// ✅ ESM default imports
import MyClass from './path/to/module.js';

// ✅ CommonJS requires
const { MyClass } = require('./path/to/module');

// ✅ Classes defined in the same file
class MyClass { ... }
const instance = await procxy(MyClass);
```

### When to Use Explicit Paths

There are cases where auto-detection won't work:

```typescript
// ❌ Dynamic imports - must provide explicit path
const { Worker } = await import('./worker.js');
const worker = await procxy(Worker, './worker.js');

// ❌ Re-exported classes with different names
import { OriginalClass as AliasedClass } from './module.js';
const instance = await procxy(AliasedClass, './module.js');

// ❌ Classes from complex barrel exports
import { DeepNestedClass } from './barrel/index.js';
const instance = await procxy(DeepNestedClass, './barrel/deep/nested.js');
```

### Best Practices

```typescript
// 👍 Recommended: Let procxy detect the path
import { Calculator } from './calculator.js';
const calc = await procxy(Calculator);

// 👍 Also good: Explicit path when needed
const calc = await procxy(Calculator, './calculator.js');

// 👎 Avoid: Using anonymous classes (name required for resolution)
const calc = await procxy(class { add(a, b) { return a + b; } });
// Throws: Constructor must be a named class
```

## 📚 API Reference

### `procxy<T>(Class, modulePath?, options?, ...constructorArgs)`

Creates a process-based proxy for a class instance.

**Parameters:**

- `Class: Constructor<T>` - The class constructor to instantiate
- `modulePath?: string` - **Optional** path to the module containing the class (auto-detected if omitted)
- `options?: ProcxyOptions` - Optional configuration
- `...constructorArgs` - Arguments for the class constructor

**Returns:** `Promise<Procxy<T>>` - Proxy object with all methods transformed to async

**Module Path Auto-Detection:**

procxy can automatically detect the module path by parsing your source file's import statements:

```typescript
import { Worker } from './worker.js';  // procxy detects this!

// No modulePath needed
const worker = await procxy(Worker);
```

The module path is auto-detected from:
- ESM named imports: `import { Class } from './path'`
- ESM default imports: `import Class from './path'`
- CommonJS imports: `const { Class } = require('./path')`
- Class definitions in the same file

**When to provide explicit modulePath:**
- Dynamic imports: `const { Worker } = await import('./worker')`
- Ambiguous import scenarios
- When importing from multiple locations

**Example:**

```typescript
const worker = await procxy(Worker, './worker.js', {
  timeout: 60000,  // 60s per method call
  retries: 3,      // Retry 3 times on failure
  env: { NODE_ENV: 'production' },
  cwd: '/tmp'
});
```

### `Procxy<T>` Type

The proxy type that wraps your class instance:

- **Methods**: All methods become `async` and return `Promise<ReturnType>`
- **Properties**: Public properties available as read-only on the parent proxy (updated from child)
- **Callbacks**: Function parameters are automatically proxied across process boundaries
- **Filtering**: Only JSON-serializable methods and properties are included
- **Lifecycle Methods**:
  - `$terminate(): Promise<void>` - Terminate the child process
  - `$process: ChildProcess` - Access the underlying process
- **Disposable**: Supports `using` and `await using` for automatic cleanup

### `ProcxyOptions`

Configuration options:

```typescript
interface ProcxyOptions {
  timeout?: number;      // Timeout per method call (default: 30000ms)
  retries?: number;      // Retry attempts (default: 3)
  env?: Record<string, string>;  // Custom environment variables
  cwd?: string;          // Working directory for child process
  args?: Jsonifiable[];  // Command line arguments
}
```

## 🎯 Use Cases

### CPU-Intensive Tasks

Offload heavy computations without blocking the event loop:

```typescript
class ImageProcessor {
  async resize(image: Buffer, width: number): Promise<Buffer> {
    // Heavy image processing
  }
}

await using processor = await procxy(ImageProcessor, './image-processor.js');
const resized = await processor.resize(imageData, 800);
```

### Isolated Execution

Run untrusted code in isolated processes:

```typescript
class SandboxedRunner {
  async execute(code: string): Promise<any> {
    // Execute in isolated environment
  }
}

const sandbox = await procxy(SandboxedRunner, './sandbox.js', {
  timeout: 5000,  // Kill after 5s
  env: { NODE_ENV: 'sandbox' }
});
```

### EventEmitter Support

Classes extending EventEmitter work transparently:

```typescript
import { EventEmitter } from 'events';

class DataStream extends EventEmitter {
  async start(): Promise<void> {
    // Stream data and emit events
    this.emit('data', { chunk: 'example' });
  }
}

const stream = await procxy(DataStream, './stream.js');

stream.on('data', (chunk) => {
  console.log('Received:', chunk);
});

await stream.start();
```

### Callback Support

Pass callbacks as function parameters and they'll be transparently proxied across the process boundary:

```typescript
class AsyncWorker {
  async processWithCallback(
    data: string[],
    onProgress: (current: number, total: number) => void
  ): Promise<string[]> {
    const result = [];
    for (let i = 0; i < data.length; i++) {
      result.push(data[i].toUpperCase());
      onProgress(i + 1, data.length);  // Invokes callback in parent
    }
    return result;
  }
}

const worker = await procxy(AsyncWorker, './async-worker.js');

const result = await worker.processWithCallback(
  ['hello', 'world'],
  (current, total) => {
    console.log(`Progress: ${current}/${total}`);
  }
);

// Output:
// Progress: 1/2
// Progress: 2/2
```

**How Callbacks Work:**
- Callback functions are serialized as callback IDs
- A registry maintains references in both processes
- IPC messages proxy callback invocations
- Automatic cleanup when the process terminates
- Bidirectional: parent can pass callbacks to child, child can invoke them

### Properties Support

Public properties are accessible as read-only on the parent and can be read/modified on the child:

```typescript
class Counter {
  public count: number = 0;
  public name: string = '';

  increment(): void {
    this.count++;
  }

  setName(newName: string): void {
    this.name = newName;
  }

  getCount(): number {
    return this.count;
  }
}

const counter = await procxy(Counter, './counter.js');

// Properties are read-only on parent
console.log(counter.count);  // 0 - synchronous read from property store
console.log(counter.name);   // '' - synchronous read

// Modify via child methods
await counter.increment();
await counter.setName('MyCounter');

// Parent reads updated values
console.log(counter.count);  // 1 - automatically synced from child
console.log(counter.name);   // 'MyCounter' - automatically synced
```

**Property Synchronization:**
- Parent maintains a property store synchronized from the child
- Child can read properties directly (no IPC needed)
- Child can set properties (sends update to parent)
- Property updates are automatically synced after method calls
- Parent can only read properties (attempting to set throws an error)
- No race conditions: only the child can modify properties

## 🛡️ Error Handling

All errors from the child process are propagated with full stack traces:

```typescript
import { TimeoutError, ChildCrashedError } from 'procxy';

try {
  await proxy.slowMethod();
} catch (err) {
  if (err instanceof TimeoutError) {
    console.log('Timeout after', err.timeoutMs, 'ms');
  } else if (err instanceof ChildCrashedError) {
    console.log('Child crashed with code:', err.exitCode);
  } else {
    console.log('Remote error:', err.message);
    console.log('Stack trace:', err.stack);
  }
}
```

### Error Types

- `ProcxyError` - Base error class
- `TimeoutError` - Method call exceeded timeout
- `ChildCrashedError` - Child process exited unexpectedly
- `ModuleResolutionError` - Cannot find or load the module
- `SerializationError` - Arguments/return values not JSON-serializable
- `OptionsValidationError` - Invalid configuration options

## ⚙️ Configuration

### Timeouts and Retries

```typescript
const worker = await procxy(Worker, './worker.js', {
  timeout: 60000,  // 60 seconds per call
  retries: 5       // Retry 5 times before failing
});
```

### Custom Environment

```typescript
const worker = await procxy(Worker, './worker.js', {
  env: {
    NODE_ENV: 'production',
    API_KEY: process.env.API_KEY,
    LOG_LEVEL: 'debug'
  }
});
```

### Working Directory

```typescript
const worker = await procxy(Worker, './worker.js', {
  cwd: '/tmp/workspace'
});
```

## 🔍 Limitations

1. **JSON Serialization** - Method arguments and return values must be JSON-serializable (functions are proxied as callbacks)
2. **Properties Read-Only on Parent** - Parent can only read properties, modifications must be done via child methods
3. **One-Way Events** - EventEmitter events only flow from child to parent (emit only works in child)
4. **Callback Context** - Callbacks are invoked with serialized arguments (e.g., no `this` binding)

## 🧪 Testing

```bash
# Run all tests
pnpm test

# Run tests with coverage
pnpm test:coverage

# Run specific test file
pnpm test tests/integration/basic-invocation.test.ts
```

## 📊 Performance

- **Method call overhead**: <10ms average
- **Memory overhead**: <1MB per instance
- **Bundle size**: <50KB minified
- **Test coverage**: >90%

## 🔧 Troubleshooting

### Module Resolution Errors

If you get `ModuleResolutionError`, ensure the `modulePath` argument points to the correct file:

```typescript
// ✅ Correct - explicit path
await procxy(Worker, './worker.js');
await procxy(Worker, '/absolute/path/to/worker.js');

// ❌ Wrong - missing module path
await procxy(Worker);  // Error!
```

### Serialization Errors

Ensure all arguments and return values are JSON-serializable:

```typescript
// ✅ OK
await proxy.process({ name: 'test', count: 42 });

// ❌ Not OK - contains function
await proxy.process({ name: 'test', fn: () => {} });
```

### Timeout Issues

Increase timeout for long-running methods:

```typescript
const worker = await procxy(Worker, './worker.js', {
  timeout: 300000  // 5 minutes
});
```

## 🤝 Contributing

Contributions welcome! Please read [CONTRIBUTING.md](./CONTRIBUTING.md) first.

## 🚀 Future Enhancements

We're planning several exciting features for future releases:

### Computed Properties

Support for getters/setters with custom logic:

```typescript
// This will be possible in a future release
class Temperature {
  private _celsius: number = 0;

  get fahrenheit(): number {
    return (this._celsius * 9/5) + 32;  // Computed property
  }

  set fahrenheit(value: number) {
    this._celsius = (value - 32) * 5/9;
  }
}

const temp = await procxy(Temperature, './temperature.js');
console.log(temp.fahrenheit);  // Computed value from child
```

### Async Property Access

Lazy-load or compute properties asynchronously:

```typescript
class DataLoader {
  async $loadConfig(): Promise<Config> {
    // Load from disk/network
  }
}

const loader = await procxy(DataLoader, './loader.js');
const config = await loader.$loadConfig();
```

### TypedEmitter Integration

Full support for strongly-typed EventEmitter patterns:

```typescript
type Events = {
  progress: [number, number];  // [current, total]
  complete: [result: string];
};

class Task extends EventEmitter<Events> {
  async run(): Promise<string> {
    this.emit('progress', 1, 10);
    // ...
    return 'done';
  }
}
```

## 📚 More Examples

### Data Processing Pipeline

```typescript
class ImageProcessor {
  async resize(data: Buffer, width: number): Promise<Buffer> {
    // Heavy computation in isolated process
  }

  async compress(data: Buffer, quality: number): Promise<Buffer> {
    // Another heavy operation
  }
}

await using processor = await procxy(ImageProcessor, './image-processor.js');

let image = await processor.resize(imageData, 800);
image = await processor.compress(image, 85);

console.log('Processed:', image.length, 'bytes');
```

### Worker Pool Pattern

```typescript
class WorkerPool {
  private workers: any[] = [];

  async initialize(poolSize: number): Promise<void> {
    for (let i = 0; i < poolSize; i++) {
      this.workers.push(await procxy(Worker, './worker.js'));
    }
  }

  async execute(task: string): Promise<string> {
    const worker = this.workers[Math.floor(Math.random() * this.workers.length)];
    return await worker.processTask(task);
  }

  async shutdown(): Promise<void> {
    await Promise.all(this.workers.map(w => w.$terminate()));
  }
}
```

### Real-Time Data Streaming

```typescript
class DataStream extends EventEmitter {
  async startStream(filter: (x: any) => boolean): Promise<void> {
    // Start streaming data
  }
}

const stream = await procxy(DataStream, './stream.js');

let dataCount = 0;
stream.on('data', (chunk) => {
  console.log('Chunk:', chunk);
  dataCount++;
});

stream.on('complete', () => {
  console.log('Total chunks:', dataCount);
});

await stream.startStream(x => x.value > 100);
```

### Batch Processing with Progress

```typescript
class BatchProcessor {
  async processBatch(
    items: string[],
    onProgress: (processed: number, total: number, item: string) => void
  ): Promise<string[]> {
    const results = [];
    for (let i = 0; i < items.length; i++) {
      const result = await this.heavyProcess(items[i]);
      results.push(result);
      onProgress(i + 1, items.length, items[i]);
    }
    return results;
  }

  private async heavyProcess(item: string): Promise<string> {
    // CPU-intensive work
    return item.toUpperCase();
  }
}

const processor = await procxy(BatchProcessor, './batch-processor.js');

const results = await processor.processBatch(
  ['item1', 'item2', 'item3'],
  (processed, total, current) => {
    console.log(`Processed ${processed}/${total} (${current})`);
  }
);

console.log('Results:', results);
```

### Async Factory Pattern

Use static factory methods or wrapper functions for cleaner initialization:

```typescript
class Database {
  private connectionString: string = '';
  private connected: boolean = false;

  async connect(url: string): Promise<void> {
    this.connectionString = url;
    this.connected = true;
    // Simulate connection setup
    await new Promise(r => setTimeout(r, 100));
  }

  async query(sql: string): Promise<any[]> {
    if (!this.connected) throw new Error('Not connected');
    return [{ result: 'example' }];
  }
}

// Factory function for cleaner API
async function createDatabase(url: string) {
  const db = await procxy(Database, './database.js');
  await db.connect(url);
  return db;
}

// Usage
const db = await createDatabase('postgres://localhost/mydb');
const results = await db.query('SELECT * FROM users');
await db.$terminate();
```

### Builder Pattern with Async Configuration

Build complex instances with fluent API and async setup:

```typescript
class WorkerBuilder {
  private name: string = 'Worker';
  private threads: number = 1;
  private timeout: number = 30000;

  setName(name: string): void {
    this.name = name;
  }

  setThreads(threads: number): void {
    this.threads = threads;
  }

  setTimeout(ms: number): void {
    this.timeout = ms;
  }

  async build(): Promise<Procxy<Worker>> {
    const worker = await procxy(
      Worker,
      './worker.js',
      { timeout: this.timeout },
      this.name,
      this.threads
    );

    // Async initialization
    await worker.initialize();
    return worker;
  }
}

// Usage with fluent API
const worker = await new WorkerBuilder()
  .setName('ImageProcessor')
  .setThreads(4)
  .setTimeout(60000)
  .build();

await worker.processImage(imageData);
```

### Resource Pool with Async Initialization

Manage a pool of async-initialized resources:

```typescript
class AsyncResourcePool<T> {
  private available: Procxy<T>[] = [];
  private inUse = new Set<Procxy<T>>();

  async initialize(
    factory: () => Promise<Procxy<T>>,
    poolSize: number
  ): Promise<void> {
    for (let i = 0; i < poolSize; i++) {
      const resource = await factory();
      this.available.push(resource);
    }
  }

  async acquire(): Promise<Procxy<T>> {
    while (this.available.length === 0) {
      // Wait for resource to be released
      await new Promise(r => setTimeout(r, 10));
    }
    const resource = this.available.pop()!;
    this.inUse.add(resource);
    return resource;
  }

  release(resource: Procxy<T>): void {
    this.inUse.delete(resource);
    this.available.push(resource);
  }

  async shutdown(): Promise<void> {
    const allResources = [...this.available, ...this.inUse];
    await Promise.all(allResources.map(r => r.$terminate()));
  }
}

// Usage
async function createWorker() {
  return await procxy(Worker, './worker.js');
}

const pool = new AsyncResourcePool<Worker>();
await pool.initialize(createWorker, 5);

// Acquire and use
const worker = await pool.acquire();
try {
  const result = await worker.process(data);
} finally {
  pool.release(worker);
}

// Cleanup
await pool.shutdown();
```

### Lazy Initialization with Singleton Pattern

Create and cache instances on first use:

```typescript
class LazyWorkerSingleton {
  private static instance: Procxy<Worker> | null = null;

  static async getInstance(): Promise<Procxy<Worker>> {
    if (!this.instance) {
      console.log('Initializing worker...');
      this.instance = await procxy(Worker, './worker.js');

      // Set up cleanup on process exit
      process.on('exit', async () => {
        if (this.instance) {
          await this.instance.$terminate();
        }
      });
    }
    return this.instance;
  }

  static async reset(): Promise<void> {
    if (this.instance) {
      await this.instance.$terminate();
      this.instance = null;
    }
  }
}

// Usage - only creates once
const worker1 = await LazyWorkerSingleton.getInstance();
const worker2 = await LazyWorkerSingleton.getInstance();
console.log(worker1 === worker2); // true - same instance

// Reset if needed
await LazyWorkerSingleton.reset();
```

### Dependency Injection with Async Resolution

Resolve dependencies asynchronously before using proxies:

```typescript
class ServiceContainer {
  private services = new Map<string, any>();

  async register<T>(
    name: string,
    factory: () => Promise<Procxy<T>>
  ): Promise<void> {
    this.services.set(name, await factory());
  }

  get<T>(name: string): Procxy<T> {
    const service = this.services.get(name);
    if (!service) throw new Error(`Service '${name}' not found`);
    return service;
  }

  async shutdown(): Promise<void> {
    const promises = Array.from(this.services.values())
      .map(service => service.$terminate?.());
    await Promise.all(promises);
  }
}

// Setup
const container = new ServiceContainer();

await container.register('database', () =>
  procxy(Database, './database.js')
);

await container.register('cache', () =>
  procxy(Cache, './cache.js')
);

// Usage with injected dependencies
const db = container.get<Database>('database');
const cache = container.get<Cache>('cache');

await db.query('SELECT ...');

// Cleanup all
await container.shutdown();
```

## 📄 License

MIT

## 🔗 Links

- [Documentation](https://github.com/pradeepmouli/procxy)
- [npm Package](https://www.npmjs.com/package/procxy)
- [Issue Tracker](https://github.com/pradeepmouli/procxy/issues)
- [Changelog](./CHANGELOG.md)

---

**Made with ❤️ by the Procxy team**
