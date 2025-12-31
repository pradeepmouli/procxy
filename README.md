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
- **🪄 Automatic Module Resolution** - Zero-config import path detection from your source code
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
import { procxy } from 'procxy';
import { Calculator } from './calculator.js';

// Automatic cleanup with await using
await using calc = await procxy(Calculator);
const result = await calc.add(5, 3);
// Automatically terminated when scope exits
```

### Constructor Arguments

```typescript
import { procxy } from 'procxy';
import { Worker } from './worker.js';

// Worker class (in worker.ts):
// class Worker {
//   constructor(public name: string, public threads: number) {}
//
//   async process(data: string[]): Promise<string[]> {
//     return data.map(s => s.toUpperCase());
//   }
// }

// Pass constructor arguments after options
const worker = await procxy(
  Worker,
  undefined,      // options (or omit entirely)
  'MyWorker',     // name argument
  4               // threads argument
);

const result = await worker.process(['hello', 'world']);
// ['HELLO', 'WORLD']

await worker.$terminate();
```

## 🪄 Automatic Module Resolution

One of procxy's most convenient features is **automatic module path detection**. You don't need to manually specify where your class is located - procxy will figure it out by parsing your import statements at runtime.

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

- `Class: Constructor<T>` - The class constructor to instantiate (must be a named class)
- `modulePath?: string` - **Optional** - Path to the module containing the class
  - **Omit this parameter** when using static imports (automatic resolution)
  - **Provide explicitly** for dynamic imports or complex re-exports
- `options?: ProcxyOptions` - Optional configuration
- `...constructorArgs` - Arguments for the class constructor

**Returns:** `Promise<Procxy<T>>` - Proxy object with all methods transformed to async

**Module Path Auto-Detection:**

When `modulePath` is omitted, procxy automatically detects the module path by:
1. Inspecting the call stack to find where procxy was called
2. Reading and parsing the source file for import/require statements
3. Matching the class name to find the corresponding import path

This works with ESM imports, CommonJS requires, and classes defined in the same file. See [Automatic Module Resolution](#-automatic-module-resolution) for details.

### `Procxy<T>` Type

The proxy type that wraps your class instance:

- **Methods**: All methods become `async` and return `Promise<ReturnType>`
- **Properties**: Public properties are read-only on the parent (synchronized from child after method calls)
- **Callbacks**: Function parameters are automatically proxied bidirectionally across processes
- **Events**: EventEmitter events flow from child to parent transparently
- **Lifecycle Methods**:
  - `$terminate(): Promise<void>` - Gracefully terminate the child process
  - `$process: ChildProcess` - Access the underlying Node.js child process
- **Disposable Protocol**: Supports `using` and `await using` for automatic cleanup
- **Type Safety**: Full TypeScript IntelliSense and autocomplete support

### `ProcxyOptions`

Configuration options for customizing child process behavior:

```typescript
interface ProcxyOptions {
  modulePath?: string;               // Path to module (optional if using static imports)
  timeout?: number;                  // Timeout per method call in ms (default: 30000)
  retries?: number;                  // Number of retry attempts on failure (default: 3)
  env?: Record<string, string>;      // Custom environment variables for child process
  cwd?: string;                      // Working directory for child process
  args?: Jsonifiable[];              // Additional command line arguments
  serialization?: 'json' | 'advanced'; // Serialization mode (default: 'json')
  supportHandles?: boolean;          // Enable handle passing for sockets (advanced mode only)
}
```

**Examples:**

```typescript
import { procxy } from 'procxy';
import { HeavyWorker } from './heavy-worker.js';
import { APIClient } from './api-client.js';
import { FileProcessor } from './file-processor.js';
import { BinaryProcessor } from './binary-processor.js';

// Long-running operations
await procxy(HeavyWorker, { timeout: 300000 });  // 5 minutes

// Custom environment
await procxy(APIClient, {
  env: { API_KEY: process.env.API_KEY }
});

// Isolated working directory
await procxy(FileProcessor, { cwd: '/tmp/workspace' });

// Advanced serialization for binary data
await procxy(BinaryProcessor, { serialization: 'advanced' });
```

## 🎯 Use Cases

### CPU-Intensive Tasks

Offload heavy computations without blocking the event loop:

```typescript
import { procxy } from 'procxy';
import { ImageProcessor } from './image-processor.js';

await using processor = await procxy(ImageProcessor);
const resized = await processor.resize(imageData, 800);
```

### Isolated Execution

Run untrusted code in isolated processes:

```typescript
import { procxy } from 'procxy';
import { SandboxedRunner } from './sandbox.js';

const sandbox = await procxy(SandboxedRunner, {
  timeout: 5000,  // Kill after 5s
  env: { NODE_ENV: 'sandbox' }
});
```

### EventEmitter Support

Classes extending EventEmitter work transparently:

```typescript
import { procxy } from 'procxy';
import { EventEmitter } from 'events';
import { DataStream } from './stream.js';

// DataStream class (in stream.ts):
// class DataStream extends EventEmitter {
//   async start(): Promise<void> {
//     this.emit('data', { chunk: 'example' });
//   }
// }

const stream = await procxy(DataStream);

stream.on('data', (chunk) => {
  console.log('Received:', chunk);
});

await stream.start();
```

### Callback Support

Pass callbacks as function parameters and they'll be transparently proxied across the process boundary:

```typescript
import { procxy } from 'procxy';
import { AsyncWorker } from './async-worker.js';

// AsyncWorker class (in async-worker.ts):
// class AsyncWorker {
//   async processWithCallback(
//     data: string[],
//     onProgress: (current: number, total: number) => void
//   ): Promise<string[]> {
//     const result = [];
//     for (let i = 0; i < data.length; i++) {
//       result.push(data[i].toUpperCase());
//       onProgress(i + 1, data.length);  // Invokes callback in parent
//     }
//     return result;
//   }
// }

const worker = await procxy(AsyncWorker);

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

Public properties are accessible with different capabilities on parent vs. child:

**Parent Process (Read-Only):**
- **Get**: Synchronous property reads from local property store
- Properties are automatically synced after each method call

**Child Process (Read/Write):**
- **Get**: Direct property access (no IPC overhead)
- **Set**: Modifies property and syncs to parent

```typescript
// counter.ts
import { procxy } from 'procxy';

class Counter {
  public count: number = 0;
  public name: string = '';

  increment(): void {
    // Child can SET properties directly
    this.count++;
  }

  setName(newName: string): void {
    // Child can SET properties
    this.name = newName;
  }

  getCount(): number {
    // Child can GET properties directly (no IPC)
    return this.count;
  }

  getName(): string {
    // Child can GET properties directly
    return this.name;
  }
}

// main.ts
import { procxy } from 'procxy';
import { Counter } from './counter.js';

const counter = await procxy(Counter);

// Parent can GET properties (synchronous read from property store)
console.log(counter.count);  // 0 - no IPC, reads from local store
console.log(counter.name);   // '' - synchronous

// Modify via child methods (parent CANNOT set directly)
await counter.increment();
await counter.setName('MyCounter');

// Parent GETs updated values (automatically synced from child)
console.log(counter.count);  // 1 - synced after increment()
console.log(counter.name);   // 'MyCounter' - synced after setName()

// Parent cannot SET properties (read-only)
// counter.count = 5;  // ❌ Throws error: properties are read-only on parent
```

**Property Synchronization:**
- Parent maintains a property store synchronized from the child
- Child can **get** and **set** properties directly (no IPC needed for reads)
- Property updates are automatically synced to parent after method calls
- Parent can only **get** properties (attempting to set throws an error)
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
import { procxy } from 'procxy';
import { Worker } from './worker.js';

const worker = await procxy(Worker, {
  timeout: 60000,  // 60 seconds per call
  retries: 5       // Retry 5 times before failing
});
```

### Custom Environment

```typescript
import { procxy } from 'procxy';
import { Worker } from './worker.js';

const worker = await procxy(Worker, {
  env: {
    NODE_ENV: 'production',
    API_KEY: process.env.API_KEY,
    LOG_LEVEL: 'debug'
  }
});
```

### Working Directory

```typescript
import { procxy } from 'procxy';
import { Worker } from './worker.js';

const worker = await procxy(Worker, {
  cwd: '/tmp/workspace'
});
```

## 🎨 Advanced Serialization (V8 Structured Clone)

By default, procxy uses JSON serialization for IPC messages. However, you can enable **advanced serialization mode** to support additional data types using V8's structured clone algorithm.

### Supported Types in Advanced Mode

When using `serialization: 'advanced'`, you can pass these additional types:

- **Binary Data**: `Buffer`, `ArrayBuffer`, `TypedArray` (Uint8Array, Int32Array, Float32Array, etc.)
- **Collections**: `Map`, `Set` with full fidelity (not converted to arrays)
- **Large Numbers**: `BigInt` values
- **Built-in Objects**: `Date`, `RegExp`, `Error` instances with all properties preserved

### Usage

```typescript
import { procxy } from 'procxy';
import { ImageProcessor } from './image-processor.js';

// Enable advanced serialization
await using processor = await procxy(ImageProcessor, {
  serialization: 'advanced'  // 👈 Enable V8 structured clone
});

// Now you can pass Buffer, TypedArray, Map, Set, BigInt, etc.
const imageBuffer = Buffer.from(imageData);
const processed = await processor.processImage(imageBuffer);

// Use Map for caching
const cache = new Map([
  ['key1', Buffer.from('data1')],
  ['key2', Buffer.from('data2')]
]);
await processor.bulkCache(cache);

// Use BigInt for large numbers
const timestamp = BigInt(Date.now()) * BigInt(1000000);
await processor.recordTimestamp(timestamp);

// TypedArray for binary protocols
const binaryData = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
await processor.sendBinary(binaryData);

// Set for unique collections
const uniqueIds = new Set([1, 2, 3, 4, 5]);
await processor.processIds(uniqueIds);
```

### Example: Binary Data Processing

```typescript
// binary-processor.ts
export class BinaryProcessor {
  // Process Buffer data
  processBuffer(data: Buffer): Buffer {
    const result = Buffer.alloc(data.length);
    for (let i = 0; i < data.length; i++) {
      result[i] = data[i] ^ 0xFF;  // XOR transformation
    }
    return result;
  }

  // Work with TypedArray
  sumFloat32Array(arr: Float32Array): number {
    return arr.reduce((sum, val) => sum + val, 0);
  }

  // Use Map for caching
  private cache = new Map<string, Buffer>();

  cacheData(key: string, data: Buffer): void {
    this.cache.set(key, data);
  }

  getAllCache(): Map<string, Buffer> {
    return new Map(this.cache);  // Returns actual Map, not array
  }

  // Process BigInt
  multiplyBigInt(a: bigint, b: bigint): bigint {
    return a * b;
  }
}

// main.ts
import { procxy } from 'procxy';
import { BinaryProcessor } from './binary-processor.js';

await using processor = await procxy(BinaryProcessor, {
  serialization: 'advanced'
});

// Process binary data
const input = Buffer.from([0x00, 0x11, 0x22, 0x33]);
const output = await processor.processBuffer(input);
// Buffer: [0xFF, 0xEE, 0xDD, 0xCC]

// Work with TypedArray
const floats = new Float32Array([1.1, 2.2, 3.3]);
const sum = await processor.sumFloat32Array(floats);  // 6.6

// Use Map
await processor.cacheData('key1', Buffer.from('data1'));
const cache = await processor.getAllCache();  // Returns Map, not array
console.log(cache instanceof Map);  // true
console.log(cache.get('key1')?.toString());  // 'data1'

// BigInt support
const result = await processor.multiplyBigInt(BigInt(123), BigInt(456));
console.log(result);  // 56088n
```

### JSON vs Advanced Mode Comparison

| Feature | JSON Mode (default) | Advanced Mode |
|---------|-------------------|---------------|
| Primitives (string, number, boolean) | ✅ | ✅ |
| Objects & Arrays | ✅ | ✅ |
| null & undefined | ✅ | ✅ |
| Buffer | ❌ | ✅ |
| TypedArray | ❌ | ✅ |
| Map | ❌ | ✅ |
| Set | ❌ | ✅ |
| BigInt | ❌ | ✅ |
| Date | ⚠️ (as string) | ✅ (as Date) |
| RegExp | ⚠️ (as object) | ✅ (as RegExp) |
| Error | ⚠️ (partial) | ✅ (full props) |
| Handle Passing (sockets) | ❌ | ✅ (with `supportHandles`) |
| Performance | Faster for simple objects | Slightly slower |

### Handle Passing

Advanced serialization mode also enables **handle passing** - the ability to transfer network sockets and server handles between processes.

```typescript
import { procxy } from 'procxy';
import * as net from 'net';

class SocketHandler {
  registerConnection(id: string, socket: net.Socket): void {
    socket.on('data', (data) => {
      console.log(`Received on ${id}:`, data.toString());
    });
  }
}

// Enable handle passing
const handler = await procxy(SocketHandler, {
  serialization: 'advanced',
  supportHandles: true  // Required for handle passing
} as const);  // Use 'as const' for type inference

// Create a server and accept connections
const server = net.createServer((socket) => {
  // Transfer the socket to the child process
  handler.$sendHandle(socket, 'connection-1');  // TypeScript knows $sendHandle is available!

  // Register it in the child
  handler.registerConnection('connection-1', socket);
});

server.listen(8080);
```

**Platform Support:**
- ✅ **Unix/Linux/macOS**: Full support for socket transfer
- ⚠️ **Windows**: Limited support - some handle types may not work correctly

See [examples/advanced-serialization/socket-transfer.ts](./examples/advanced-serialization/socket-transfer.ts) for a complete example.

### When to Use Advanced Mode

**Use JSON mode (default) when:**
- Working with simple data structures (objects, arrays, primitives)
- Maximum performance is critical for simple types
- No need for binary data or collections

**Use Advanced mode when:**
- Processing binary data (images, files, network protocols)
- Working with Map/Set collections
- Handling large numbers with BigInt
- Need to preserve Date/RegExp/Error objects with full fidelity
- Transferring TypedArray data between processes
- **Passing network sockets between processes** (requires `supportHandles: true`)

### More Examples

See [examples/advanced-serialization/](./examples/advanced-serialization/) for comprehensive examples:
- [Buffer Processing](./examples/advanced-serialization/buffer-processing.ts) - Image data processing with Buffers
- [BigInt Calculations](./examples/advanced-serialization/bigint-calculations.ts) - Large number operations
- [Collection Processing](./examples/advanced-serialization/collection-processing.ts) - Map and Set usage
- [Socket Transfer](./examples/advanced-serialization/socket-transfer.ts) - Handle passing with network sockets
- [Error Preservation](./examples/advanced-serialization/error-preservation.ts) - Full Error object preservation
- [Migration Guide](./examples/advanced-serialization/migration-guide.md) - Step-by-step migration from JSON mode

### Performance Considerations

Advanced serialization has a small overhead compared to JSON for simple objects, but enables much broader type support. See [Performance Benchmarks](#-performance) for detailed comparisons.

```typescript
// Benchmark results (see benchmark/serialization-comparison.ts)
// Simple object (100 calls):
//   JSON mode: 0.12ms average
//   Advanced mode: 0.15ms average (~25% slower)
//
// Buffer data (100 calls):
//   JSON mode: Not supported
//   Advanced mode: 0.18ms average
//
// Map with 100 entries (100 calls):
//   JSON mode: Not supported
//   Advanced mode: 0.25ms average
```

## 🔍 Limitations

Understanding these constraints will help you use procxy effectively:

1. **Serialization Requirements**
   - **JSON mode (default)**: Method arguments and return values must be JSON-serializable
   - **Advanced mode**: Supports V8 structured clone types (Buffer, Map, Set, BigInt, etc.)
   - Functions are automatically proxied as callbacks (no manual serialization needed)
   - **JSON mode**: Circular references and symbols are not supported
   - **Advanced mode**: Circular references are supported via V8 structured clone; symbols are not supported

2. **Parent Properties Are Read-Only**
   - Parent process can only **read** properties (via local synchronized store)
   - Child process can **read and write** properties
   - Modifications must be done via child methods, not direct assignment on parent

3. **One-Way Event Flow**
   - EventEmitter events flow from child → parent only
   - Parent can listen to events, but cannot emit events to the child
   - The child process owns the EventEmitter instance

4. **Callback Context Limitations**
   - Callbacks are invoked with serialized arguments
   - No `this` binding preservation across process boundaries
   - Callback functions cannot access closure variables from the other process

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

If you get `ModuleResolutionError`, ensure you have a static import or provide an explicit `modulePath`:

```typescript
// ✅ Best - automatic resolution with static import
import { Worker } from './worker.js';
await procxy(Worker);

// ✅ Also works - explicit path
await procxy(Worker, './worker.js');

// ❌ Won't work - dynamic import without explicit path
const { Worker } = await import('./worker.js');
await procxy(Worker);  // Error: Cannot resolve module path!

// ✅ Fix - provide explicit path with dynamic import
const { Worker } = await import('./worker.js');
await procxy(Worker, './worker.js');
```

### Serialization Errors

Ensure all arguments and return values are serializable for your chosen mode:

**JSON Mode:**
```typescript
// ✅ OK
await proxy.process({ name: 'test', count: 42 });

// ❌ Not OK - contains function
await proxy.process({ name: 'test', fn: () => {} });

// ❌ Not OK - Buffer requires advanced mode
await proxy.processImage(Buffer.from('data'));
```

**Advanced Mode:**
```typescript
// Enable advanced mode
const proxy = await procxy<Worker, 'advanced'>(
  Worker,
  { serialization: 'advanced' }
);

// ✅ Now OK - Buffer is supported
await proxy.processImage(Buffer.from('data'));

// ✅ OK - Map and Set supported
await proxy.processMap(new Map([['key', 'value']]));
await proxy.processSet(new Set([1, 2, 3]));

// ✅ OK - BigInt supported
await proxy.calculate(123456789n);
```

### Type Inference Issues

When using advanced serialization, ensure the type parameter matches the option:

```typescript
// ✅ Correct - type parameter matches serialization option
const worker = await procxy<Worker, 'advanced'>(
  Worker,
  { serialization: 'advanced' }
);

// ❌ Wrong - type mismatch will cause TypeScript errors
const worker = await procxy<Worker, 'json'>(
  Worker,
  { serialization: 'advanced' }  // TypeScript error!
);
```

### Handle Passing Issues

If handle passing doesn't work:

```typescript
// ✅ Ensure both advanced mode AND supportHandles are enabled with 'as const'
const handler = await procxy(Handler, {
  serialization: 'advanced',
  supportHandles: true  // Required!
} as const);  // 'as const' ensures TypeScript infers supportHandles: true

// ✅ Now $sendHandle is available in TypeScript autocomplete
await handler.$sendHandle(socket);

// ✅ Check platform - Windows has limited support
if (process.platform === 'win32') {
  console.warn('Handle passing may not work on Windows');
}
```

### Timeout Issues

Increase timeout for long-running methods:

```typescript
import { procxy } from 'procxy';
import { Worker } from './worker.js';

const worker = await procxy(Worker, {
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
import { procxy } from 'procxy';
import { ImageProcessor } from './image-processor.js';

await using processor = await procxy(ImageProcessor);

let image = await processor.resize(imageData, 800);
image = await processor.compress(image, 85);

console.log('Processed:', image.length, 'bytes');
```

### Worker Pool Pattern

```typescript
import { procxy } from 'procxy';
import { Worker } from './worker.js';

class WorkerPool {
  private workers: any[] = [];

  async initialize(poolSize: number): Promise<void> {
    for (let i = 0; i < poolSize; i++) {
      this.workers.push(await procxy(Worker));
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
import { procxy } from 'procxy';
import { DataStream } from './stream.js';

const stream = await procxy(DataStream);

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
import { procxy } from 'procxy';
import { BatchProcessor } from './batch-processor.js';

const processor = await procxy(BatchProcessor);

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
import { procxy } from 'procxy';
import { Database } from './database.js';

// Factory function for cleaner API
async function createDatabase(url: string) {
  const db = await procxy(Database);
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
import { procxy } from 'procxy';
import { Worker } from './worker.js';

class WorkerBuilder {
  private name: string = 'Worker';
  private threads: number = 1;
  private timeout: number = 30000;

  setName(name: string): this {
    this.name = name;
    return this;
  }

  setThreads(threads: number): this {
    this.threads = threads;
    return this;
  }

  setTimeout(ms: number): this {
    this.timeout = ms;
    return this;
  }

  async build(): Promise<Procxy<Worker>> {
    const worker = await procxy(
      Worker,
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
import { procxy } from 'procxy';
import { Worker } from './worker.js';

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
  return await procxy(Worker);
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
import { procxy } from 'procxy';
import { Worker } from './worker.js';

class LazyWorkerSingleton {
  private static instance: Procxy<Worker> | null = null;

  static async getInstance(): Promise<Procxy<Worker>> {
    if (!this.instance) {
      console.log('Initializing worker...');
      this.instance = await procxy(Worker);

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
import { procxy } from 'procxy';
import { Database } from './database.js';
import { Cache } from './cache.js';

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

await container.register('database', () => procxy(Database));
await container.register('cache', () => procxy(Cache));

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
