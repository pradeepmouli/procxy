# Enhancement Specification: Advanced Serialization Support

**Status:** Draft
**Version:** 1.0
**Author:** Claude
**Date:** 2025-12-31

## Executive Summary

This specification proposes enhancing procxy's serialization capabilities to support a broader range of JavaScript types beyond JSON, leveraging Node.js's V8 structured clone algorithm. The enhancement introduces a type-safe API for determining which types can be safely proxied across process boundaries.

## Table of Contents

1. [Background](#background)
2. [Current State Analysis](#current-state-analysis)
3. [Research Findings](#research-findings)
4. [Proposed Solution](#proposed-solution)
5. [Type System Design](#type-system-design)
6. [API Design](#api-design)
7. [Implementation Strategy](#implementation-strategy)
8. [Use Cases](#use-cases)
9. [Migration Path](#migration-path)
10. [Performance Considerations](#performance-considerations)
11. [Open Questions](#open-questions)

---

## Background

### Motivation

Currently, procxy restricts all method arguments and return values to JSON-serializable types (`Jsonifiable` from type-fest). This limitation excludes many useful JavaScript types that developers commonly work with:

- **Binary Data**: `Buffer`, `ArrayBuffer`, `TypedArray` (Uint8Array, Int32Array, etc.)
- **Collections**: `Map`, `Set`
- **Large Numbers**: `BigInt`
- **Error Objects**: Full error instances with stack traces
- **Complex Objects**: `RegExp`, `Date` (currently stringified)

### Goals

1. **Expand Type Support**: Enable passing binary data, collections, and other V8-serializable types
2. **Maintain Type Safety**: Provide compile-time guarantees about which types can be proxied
3. **Preserve Performance**: Minimize overhead while supporting more types
4. **Handle Passing**: Support passing special Node.js handles (sockets, servers, file descriptors)
5. **Backward Compatibility**: Ensure existing code continues to work without changes

---

## Current State Analysis

### Serialization Pipeline (As-Is)

```
┌─────────────────────────────────────────────────────────────┐
│ Parent Process                                               │
│                                                              │
│  Arguments → validateJsonifiable() → JSON.stringify() ────┐ │
│                                                            │ │
└────────────────────────────────────────────────────────────┼─┘
                                                             │
                                                             │ IPC
                                                             │
┌────────────────────────────────────────────────────────────┼─┐
│ Child Process                                              │ │
│                                                            ▼ │
│  JSON.parse() → deserializeArg() → Method Call → Result   │ │
│                                                      │     │ │
│                                                      ▼     │ │
│  serializeToJson() → JSON.stringify() ──────────────────┐ │ │
└─────────────────────────────────────────────────────────┼─┴─┘
                                                          │
                                                          │ IPC
                                                          │
┌─────────────────────────────────────────────────────────┼───┐
│ Parent Process                                          ▼   │
│  JSON.parse() → Promise.resolve(value)                      │
└─────────────────────────────────────────────────────────────┘
```

### Limitations

1. **JSON-Only**: Uses `JSON.stringify()` / `JSON.parse()` exclusively
2. **Binary Data**: Cannot pass `Buffer`, `ArrayBuffer`, `TypedArray`
3. **Collections**: Cannot pass `Map`, `Set`
4. **BigInt**: Throws error on BigInt values
5. **Date Objects**: Serialized as strings, not Date instances
6. **RegExp**: Lost during serialization
7. **Error Objects**: Only message/stack preserved, not full Error instance

---

## Research Findings

### Node.js IPC Serialization Capabilities

Based on research of Node.js documentation and source code:

#### 1. V8 Structured Clone Algorithm (Advanced Mode)

Node.js supports an `'advanced'` serialization mode using the V8 serialization API:

```javascript
const child = fork(modulePath, args, {
  serialization: 'advanced'  // Uses V8 serialization instead of JSON
});
```

**Supported Types** (beyond JSON):
- ✅ **BigInt**: `123n`
- ✅ **Map**: `new Map([['a', 1], ['b', 2]])`
- ✅ **Set**: `new Set([1, 2, 3])`
- ✅ **ArrayBuffer**: `new ArrayBuffer(8)`
- ✅ **TypedArray**: `Uint8Array`, `Int32Array`, `Float64Array`, etc.
- ✅ **DataView**: `new DataView(buffer)`
- ✅ **Buffer**: `Buffer.from('hello')`
- ✅ **Error**: Full error instances with stack traces
- ✅ **RegExp**: `/pattern/gi`
- ✅ **Date**: Full Date instances (not just strings)

**Limitations**:
- ❌ Functions (except when using callback registry)
- ❌ Symbols (property keys)
- ❌ WeakMap, WeakSet
- ❌ Streams
- ❌ Promises (they serialize but lose their state)
- ⚠️ Custom class instances: Properties are copied, but prototype chain is lost
- ⚠️ Performance: May be slower than JSON for simple objects

**Sources:**
- [Node.js Child Process Documentation](https://nodejs.org/api/child_process.html)
- [V8 Serialization Commit](https://github.com/nodejs/node/commit/df1e183e3f)

#### 2. Handle Passing (Special Objects)

Node.js allows passing certain special objects as "handles":

```javascript
child.send(message, sendHandle, options, callback);
```

**Passable Handles**:
- ✅ **net.Socket**: TCP/IPC sockets
- ✅ **net.Server**: TCP/IPC servers
- ✅ **dgram.Socket**: UDP sockets
- ✅ File descriptors (as integers on Unix)

**Limitations**:
- ⚠️ Windows: Socket passing not fully supported
- ⚠️ Ownership transfer: The handle is transferred (not cloned)

**Sources:**
- [Node.js Child Process Documentation - sendHandle](https://nodejs.org/api/child_process.html)
- [Node.js Help Issue #345](https://github.com/nodejs/help/issues/345)

---

## Proposed Solution

### High-Level Approach

1. **Introduce Serialization Modes**: Allow choosing between `'json'` and `'advanced'` serialization
2. **Type-Level Constraints**: Create `Procxiable<T>` and `IsProcxiable<T>` utility types
3. **Runtime Validation**: Extend validation to check V8-serializable types
4. **Handle Support**: Add API for passing special handles (sockets, servers)
5. **Gradual Adoption**: Make advanced mode opt-in to preserve backward compatibility

---

## Type System Design

### Core Type Definitions

```typescript
/**
 * Union of all types that can be serialized using V8's structured clone algorithm
 * when serialization mode is 'advanced'.
 */
type V8Serializable =
  | Jsonifiable                    // All JSON types
  | BigInt                         // BigInt values
  | Map<V8Serializable, V8Serializable>    // Maps with serializable keys/values
  | Set<V8Serializable>            // Sets with serializable values
  | ArrayBuffer                    // Raw binary data
  | Int8Array | Uint8Array | Uint8ClampedArray  // Typed arrays
  | Int16Array | Uint16Array
  | Int32Array | Uint32Array
  | Float32Array | Float64Array
  | BigInt64Array | BigUint64Array
  | DataView                       // Views over ArrayBuffers
  | Buffer                         // Node.js buffers
  | Date                           // Date objects (full instance, not string)
  | RegExp                         // Regular expressions
  | Error                          // Error objects (full instance)
  | V8SerializableObject           // Plain objects with V8-serializable values
  | V8SerializableArray;           // Arrays with V8-serializable elements

interface V8SerializableObject {
  [key: string]: V8Serializable;
}

type V8SerializableArray = V8Serializable[];

/**
 * Types that can be passed as handles to child processes.
 * These are transferred (not cloned) to the child.
 */
type PassableHandle =
  | net.Socket
  | net.Server
  | dgram.Socket
  | number;  // File descriptor (Unix only)

/**
 * All types that can be proxied across process boundaries.
 * Depends on the serialization mode.
 */
type Procxiable<Mode extends SerializationMode = 'json'> =
  Mode extends 'advanced' ? V8Serializable : Jsonifiable;

/**
 * Type predicate to check if a type is procxiable in the given mode.
 */
type IsProcxiable<T, Mode extends SerializationMode = 'json'> =
  T extends Procxiable<Mode> ? true : false;

/**
 * Serialization modes available for IPC.
 */
type SerializationMode = 'json' | 'advanced';
```

### Type-Level Filtering

Update the `Procxy<T>` type to respect serialization mode:

```typescript
/**
 * Filters method signatures to only include those with procxiable arguments/returns.
 */
type ProcxiableMethods<T, Mode extends SerializationMode> = {
  [K in keyof T]: T[K] extends (...args: infer Args) => infer Return
    ? AllProcxiable<Args, Mode> extends true
      ? IsProcxiable<UnwrapPromise<Return>, Mode> extends true
        ? (...args: Args) => Promise<UnwrapPromise<Return>>
        : never
      : never
    : never;
};

/**
 * Check if all types in a tuple are procxiable.
 */
type AllProcxiable<Tuple extends any[], Mode extends SerializationMode> =
  Tuple extends [infer First, ...infer Rest]
    ? IsProcxiable<First, Mode> extends true
      ? AllProcxiable<Rest, Mode>
      : false
    : true;

/**
 * The proxied type with serialization mode support.
 */
type Procxy<T, Mode extends SerializationMode = 'json'> =
  & ProcxiableMethods<T, Mode>
  & {
      readonly [K in keyof T as T[K] extends Function ? never : K]: T[K];
      $terminate(): Promise<void>;
      $process: ChildProcess;
    }
  & (T extends EventEmitter ? EventEmitterProxy : {})
  & AsyncDisposable;
```

---

## API Design

### 1. Serialization Mode Configuration

Add `serialization` option to `ProcxyOptions`:

```typescript
interface ProcxyOptions {
  timeout?: number;
  retries?: number;
  env?: Record<string, string>;
  cwd?: string;
  args?: Jsonifiable[];

  /**
   * Serialization mode for IPC communication.
   *
   * - 'json' (default): Uses JSON serialization. Supports only Jsonifiable types.
   * - 'advanced': Uses V8 structured clone algorithm. Supports BigInt, Map, Set,
   *   ArrayBuffer, TypedArray, Buffer, Date, RegExp, Error, and more.
   *
   * Note: 'advanced' mode may have performance implications for large objects.
   *
   * @default 'json'
   */
  serialization?: SerializationMode;
}
```

### 2. Type-Safe API with Serialization Mode

```typescript
/**
 * Creates a process-based proxy with automatic mode detection.
 */
function procxy<T>(
  Class: Constructor<T>,
  modulePath?: string,
  options?: ProcxyOptions & { serialization?: 'json' },
  ...constructorArgs: ConstructorParameters<Constructor<T>>
): Promise<Procxy<T, 'json'>>;

function procxy<T>(
  Class: Constructor<T>,
  modulePath?: string,
  options?: ProcxyOptions & { serialization: 'advanced' },
  ...constructorArgs: ConstructorParameters<Constructor<T>>
): Promise<Procxy<T, 'advanced'>>;

// Implementation
async function procxy<T>(
  Class: Constructor<T>,
  modulePath?: string,
  options?: ProcxyOptions,
  ...constructorArgs: any[]
): Promise<Procxy<T, any>> {
  const mode = options?.serialization ?? 'json';

  // Create child with appropriate serialization mode
  const forkOptions: ForkOptions = {
    serialization: mode,
    // ... other options
  };

  const child = fork(agentPath, args, forkOptions);

  // Rest of implementation...
}
```

### 3. Handle Passing API

Add support for passing handles:

```typescript
/**
 * Result type with handle support.
 */
interface ProcxyWithHandle<T, Mode extends SerializationMode = 'json'>
  extends Procxy<T, Mode> {
  /**
   * Send a handle (socket, server, file descriptor) to the child process.
   * The handle is transferred to the child and can only be used there.
   *
   * @param handle - The handle to send (Socket, Server, or file descriptor)
   * @returns Promise that resolves when the handle is received by the child
   *
   * @example
   * const server = net.createServer();
   * await worker.$sendHandle(server);
   */
  $sendHandle(handle: PassableHandle): Promise<void>;
}

/**
 * Creates a process-based proxy with handle support.
 */
function procxy<T>(
  Class: Constructor<T>,
  modulePath?: string,
  options?: ProcxyOptions & { supportHandles: true },
  ...constructorArgs: ConstructorParameters<Constructor<T>>
): Promise<ProcxyWithHandle<T, 'advanced'>>;
```

### 4. Validation Utilities

Provide runtime validation helpers:

```typescript
/**
 * Check if a value is procxiable in the given mode.
 *
 * @param value - Value to check
 * @param mode - Serialization mode ('json' or 'advanced')
 * @returns true if the value can be proxied in the given mode
 *
 * @example
 * isProcxiable(new Map(), 'advanced')  // true
 * isProcxiable(new Map(), 'json')      // false
 * isProcxiable(BigInt(123), 'advanced') // true
 */
export function isProcxiable(
  value: unknown,
  mode: SerializationMode = 'json'
): boolean;

/**
 * Validate that a value is procxiable, throwing if not.
 *
 * @param value - Value to validate
 * @param mode - Serialization mode
 * @param context - Description of where this value is used (for error messages)
 * @throws {SerializationError} If value is not procxiable
 */
export function validateProcxiable(
  value: unknown,
  mode: SerializationMode,
  context: string
): void;
```

---

## Implementation Strategy

### Phase 1: Core V8 Serialization Support

**Goal**: Enable `serialization: 'advanced'` mode

**Tasks**:
1. Add `serialization` option to `ProcxyOptions`
2. Pass `serialization` to `fork()` options
3. Update validation to check V8-serializable types when mode is 'advanced'
4. Add comprehensive tests for all V8-serializable types

**Files to Modify**:
- `src/parent/procxy.ts` - Add serialization option
- `src/shared/serialization.ts` - Add V8 validation logic
- `src/shared/types.ts` - Add V8Serializable types

**Validation Logic**:

```typescript
// New validation function for V8 serialization
function isV8Serializable(value: unknown): boolean {
  // Primitive types
  if (value === null || value === undefined) return true;
  if (typeof value === 'boolean' || typeof value === 'number' ||
      typeof value === 'string' || typeof value === 'bigint') return true;

  // Built-in objects
  if (value instanceof Date) return true;
  if (value instanceof RegExp) return true;
  if (value instanceof Error) return true;
  if (value instanceof Map || value instanceof Set) {
    // Check all keys/values recursively
    return Array.from(value.entries()).every(
      ([k, v]) => isV8Serializable(k) && isV8Serializable(v)
    );
  }

  // Binary types
  if (value instanceof ArrayBuffer) return true;
  if (ArrayBuffer.isView(value)) return true;  // TypedArrays, DataView
  if (Buffer.isBuffer(value)) return true;

  // Plain objects and arrays
  if (typeof value === 'object') {
    return Object.values(value).every(v => isV8Serializable(v));
  }

  return false;
}

function validateV8Serializable(value: unknown, context: string): void {
  if (!isV8Serializable(value)) {
    throw new SerializationError(
      `Value in ${context} is not V8-serializable`,
      value
    );
  }
}
```

### Phase 2: Type System Enhancement

**Goal**: Provide type-level guarantees for serialization modes

**Tasks**:
1. Define `V8Serializable`, `Procxiable<Mode>`, `IsProcxiable<T, Mode>` types
2. Update `Procxy<T, Mode>` to filter methods based on mode
3. Add overloads to `procxy()` function for mode inference
4. Update all type exports

**Files to Modify**:
- `src/shared/types.ts` - Add all type definitions
- `src/parent/procxy.ts` - Add function overloads
- `index.ts` - Export new types

### Phase 3: Handle Passing Support

**Goal**: Enable passing sockets, servers, and file descriptors

**Tasks**:
1. Add `$sendHandle()` method to proxy
2. Implement handle reception in child process
3. Add platform checks (Windows limitations)
4. Document handle ownership transfer semantics

**Files to Modify**:
- `src/parent/ipc-client.ts` - Add sendHandle support
- `src/child/agent.ts` - Add handle reception
- `src/shared/protocol.ts` - Add HandleMessage type

**API Example**:

```typescript
// Child receives handle via special method
class SocketWorker {
  private socket?: net.Socket;

  // Special method to receive handles
  async receiveSocket(socket: net.Socket): Promise<void> {
    this.socket = socket;
    socket.on('data', (data) => {
      console.log('Received:', data.toString());
    });
  }
}

// Parent sends handle
const worker = await procxy(SocketWorker, {
  serialization: 'advanced',
  supportHandles: true
});

const socket = new net.Socket();
socket.connect(8080, 'localhost');

// Send socket to child (transferred, not cloned)
await worker.$sendHandle(socket);
```

### Phase 4: Documentation and Examples

**Goal**: Comprehensive documentation for new features

**Tasks**:
1. Update README with serialization modes section
2. Add examples for each V8-serializable type
3. Document handle passing use cases
4. Add migration guide from JSON to advanced mode
5. Performance comparison benchmarks

---

## Use Cases

### 1. Binary Data Processing

**Before (Not Possible)**:
```typescript
class ImageProcessor {
  async processImage(image: Buffer): Promise<Buffer> {
    // ❌ Error: Buffer is not JSON-serializable
  }
}
```

**After**:
```typescript
import { procxy } from 'procxy';
import { ImageProcessor } from './image-processor.js';

const processor = await procxy(ImageProcessor, {
  serialization: 'advanced'
});

const imageBuffer = await fs.promises.readFile('image.png');
const processed = await processor.processImage(imageBuffer);  // ✅ Works!
await fs.promises.writeFile('output.png', processed);
```

### 2. Large Number Calculations

**Before (Not Possible)**:
```typescript
class CryptoCalculator {
  async factorial(n: bigint): Promise<bigint> {
    // ❌ Error: BigInt is not JSON-serializable
  }
}
```

**After**:
```typescript
import { procxy } from 'procxy';
import { CryptoCalculator } from './crypto.js';

const calc = await procxy(CryptoCalculator, {
  serialization: 'advanced'
});

const result = await calc.factorial(100n);  // ✅ Works!
console.log(result);  // Huge BigInt value
```

### 3. Collection Processing

**Before (Manual Conversion Required)**:
```typescript
class DataAnalyzer {
  async analyze(data: Array<[string, number]>): Promise<Array<[string, number]>> {
    // Have to pass as array of tuples instead of Map
  }
}

// Manual conversion
const dataArray = Array.from(dataMap.entries());
const resultArray = await analyzer.analyze(dataArray);
const resultMap = new Map(resultArray);
```

**After**:
```typescript
import { procxy } from 'procxy';
import { DataAnalyzer } from './analyzer.js';

class DataAnalyzer {
  async analyze(data: Map<string, number>): Promise<Map<string, number>> {
    // Can work with Map directly
    const filtered = new Map();
    for (const [key, value] of data.entries()) {
      if (value > 100) filtered.set(key, value);
    }
    return filtered;
  }
}

const analyzer = await procxy(DataAnalyzer, {
  serialization: 'advanced'
});

const dataMap = new Map([['a', 150], ['b', 50], ['c', 200]]);
const resultMap = await analyzer.analyze(dataMap);  // ✅ Direct Map usage!
console.log(resultMap);  // Map(2) { 'a' => 150, 'c' => 200 }
```

### 4. Socket Handling (Handle Passing)

**Before (Not Possible)**:
```typescript
// Could not transfer socket ownership to child
```

**After**:
```typescript
import { procxy } from 'procxy';
import { SocketHandler } from './socket-handler.js';
import net from 'net';

class SocketHandler {
  private socket?: net.Socket;

  async setSocket(socket: net.Socket): Promise<void> {
    this.socket = socket;

    socket.on('data', (data) => {
      console.log('[Child] Received:', data.toString());
      socket.write('Echo: ' + data.toString());
    });
  }

  async closeSocket(): Promise<void> {
    this.socket?.end();
  }
}

const handler = await procxy(SocketHandler, {
  serialization: 'advanced',
  supportHandles: true
});

const socket = new net.Socket();
socket.connect(8080, 'localhost');

// Transfer socket to child process
await handler.$sendHandle(socket);
// Socket now owned by child, parent can no longer use it
```

### 5. Error Handling with Full Context

**Before (Limited Error Info)**:
```typescript
// Only message and stack trace preserved
catch (error) {
  console.log(error.message);  // ✅ Works
  console.log(error.stack);    // ✅ Works
  console.log(error.code);     // ❌ Lost (undefined)
}
```

**After (Full Error Instance)**:
```typescript
import { procxy } from 'procxy';

class FileProcessor {
  async readFile(path: string): Promise<string> {
    throw Object.assign(new Error('File not found'), {
      code: 'ENOENT',
      errno: -2,
      path: path,
      syscall: 'open'
    });
  }
}

const processor = await procxy(FileProcessor, {
  serialization: 'advanced'
});

try {
  await processor.readFile('/nonexistent');
} catch (error) {
  console.log(error.message);  // ✅ File not found
  console.log(error.code);     // ✅ ENOENT
  console.log(error.errno);    // ✅ -2
  console.log(error.path);     // ✅ /nonexistent
}
```

---

## Migration Path

### Backward Compatibility

**Default Behavior**: Unchanged (JSON serialization)

```typescript
// Existing code continues to work without changes
const calc = await procxy(Calculator);  // Uses 'json' mode
```

### Opt-In to Advanced Mode

**Step 1**: Enable advanced serialization

```typescript
const worker = await procxy(Worker, {
  serialization: 'advanced'  // Opt-in
});
```

**Step 2**: Update method signatures to use V8-serializable types

```typescript
// Before
class DataProcessor {
  async process(data: string): Promise<object> {
    // JSON-serializable types only
  }
}

// After
class DataProcessor {
  async process(data: Buffer): Promise<Map<string, Uint8Array>> {
    // V8-serializable types
  }
}
```

**Step 3**: Run tests to ensure compatibility

### Gradual Migration Strategy

1. **Start with JSON mode** (default, no changes needed)
2. **Identify bottlenecks** where binary data or collections would help
3. **Enable advanced mode** for specific workers that need it
4. **Benchmark performance** to verify improvements
5. **Migrate incrementally** based on needs

---

## Performance Considerations

### V8 Serialization vs. JSON

**Benchmarks (Estimated)**:

| Data Type | JSON (ops/sec) | V8 (ops/sec) | Ratio |
|-----------|----------------|--------------|-------|
| Small object (10 props) | 500,000 | 450,000 | 0.9x |
| Large object (1000 props) | 10,000 | 12,000 | 1.2x |
| Binary data (1MB Buffer) | N/A | 50,000 | ∞ |
| Map (100 entries) | 8,000* | 80,000 | 10x |
| Set (100 entries) | 8,000* | 80,000 | 10x |

*Manual conversion to/from arrays required for JSON

### Recommendations

1. **Use JSON mode** for simple data structures (plain objects, arrays, primitives)
2. **Use advanced mode** when:
   - Working with binary data (Buffer, TypedArray)
   - Using collections (Map, Set)
   - Passing BigInt values
   - Need full Error object preservation
3. **Profile both modes** for your specific use case

### Memory Considerations

- **V8 serialization**: Slightly higher memory overhead per message
- **Handle passing**: Zero-copy transfer (most efficient for large resources)
- **JSON**: Lower memory overhead for small messages

---

## Open Questions

### 1. Default Serialization Mode

**Question**: Should the default be `'json'` or `'advanced'`?

**Options**:
- **A**: Keep `'json'` as default (current proposal)
  - ✅ Backward compatible
  - ✅ Better performance for simple objects
  - ❌ Users must opt-in to advanced features

- **B**: Make `'advanced'` the default
  - ✅ More features out of the box
  - ✅ Users don't need to know about modes
  - ❌ Breaking change for existing users
  - ❌ Potential performance regression

**Recommendation**: Keep `'json'` as default (Option A)

### 2. Stream Support

**Question**: Should we support passing streams as handles?

**Complexity**:
- Streams are not directly passable via V8 serialization
- Could implement custom stream bridging over IPC
- Would require significant implementation effort

**Recommendation**: Defer to future enhancement

### 3. Custom Class Serialization

**Question**: Should we support custom `serialize()` / `deserialize()` methods on classes?

**Example**:
```typescript
class CustomData {
  serialize(): V8Serializable {
    return { /* custom format */ };
  }

  static deserialize(data: V8Serializable): CustomData {
    return new CustomData(/* reconstruct */);
  }
}
```

**Complexity**:
- Requires protocol for discovering serialization methods
- Need to reconstruct class instances in child
- Complex error handling

**Recommendation**: Consider for future enhancement

### 4. Shared Memory (SharedArrayBuffer)

**Question**: Should we support SharedArrayBuffer for shared memory between processes?

**Considerations**:
- SharedArrayBuffer can be transferred via V8 serialization
- Enables true zero-copy shared memory
- Requires careful synchronization (Atomics)
- Security considerations (Spectre/Meltdown mitigations)

**Recommendation**: Research separately, potentially as advanced feature

---

## References

1. **Node.js Documentation**:
   - [Child Process API](https://nodejs.org/api/child_process.html)
   - [V8 Serialization Commit](https://github.com/nodejs/node/commit/df1e183e3f)

2. **Web Standards**:
   - [Structured Clone Algorithm - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm)
   - [HTML Structured Data](https://html.spec.whatwg.org/multipage/structured-data.html)

3. **Procxy Internals**:
   - Current serialization implementation: `src/shared/serialization.ts`
   - IPC protocol: `src/shared/protocol.ts`
   - Type definitions: `src/shared/types.ts`

---

## Appendix: Type Definitions Reference

### Complete Type Hierarchy

```typescript
// Level 1: Primitives
type Primitive = string | number | boolean | null | undefined;

// Level 2: JSON-serializable (current support)
type Jsonifiable = /* from type-fest */;

// Level 3: V8-serializable (proposed)
type V8Serializable =
  | Jsonifiable
  | BigInt
  | Map<V8Serializable, V8Serializable>
  | Set<V8Serializable>
  | ArrayBuffer
  | TypedArray
  | DataView
  | Buffer
  | Date
  | RegExp
  | Error
  | V8SerializableObject
  | V8SerializableArray;

// Level 4: Passable handles (proposed)
type PassableHandle =
  | net.Socket
  | net.Server
  | dgram.Socket
  | number;

// Unified procxiable type
type Procxiable<Mode extends SerializationMode = 'json'> =
  Mode extends 'advanced' ? V8Serializable : Jsonifiable;
```

### TypeScript Utility Types

```typescript
/**
 * Extract the serializable portion of a type.
 */
type ExtractSerializable<T, Mode extends SerializationMode = 'json'> = {
  [K in keyof T]: T[K] extends Procxiable<Mode> ? T[K] : never;
};

/**
 * Check if a method is procxiable in the given mode.
 */
type IsProcxiableMethod<
  Method extends (...args: any[]) => any,
  Mode extends SerializationMode = 'json'
> = Parameters<Method> extends infer Params
  ? Params extends Procxiable<Mode>[]
    ? ReturnType<Method> extends Promise<infer R>
      ? R extends Procxiable<Mode>
        ? true
        : false
      : false
    : false
  : false;

/**
 * Filter methods to only those that are procxiable.
 */
type ProcxiableMethodsOf<T, Mode extends SerializationMode = 'json'> = {
  [K in keyof T]: T[K] extends (...args: any[]) => any
    ? IsProcxiableMethod<T[K], Mode> extends true
      ? K
      : never
    : never;
}[keyof T];
```

---

## Next Steps

1. **Review**: Gather feedback on this specification
2. **Prototype**: Implement Phase 1 in a feature branch
3. **Benchmark**: Compare performance of JSON vs. advanced modes
4. **Test**: Comprehensive tests for all V8-serializable types
5. **Document**: Update README and add examples
6. **Release**: Publish as minor version (non-breaking change)

---

**End of Specification**
