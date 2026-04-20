---
name: procxy
description: "Type-safe process-based proxy for Node.js - Run class instances in isolated child processes with full TypeScript support Procxy - A TypeScript library for transparent process-based proxy of class instances. Use when: You need CPU-intensive work (parsing, compression, ML inference, image processing) isolated from the main event loop; You want EventEmitter events from a worker class forwarded transparently to the parent process; You need to sandbox third-party code so a crash in the library cannot take down the parent."
license: MIT
---

# procxy

Type-safe process-based proxy for Node.js - Run class instances in isolated child processes with full TypeScript support

## Features

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

## Quick Start

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

## When to Use


| Task | Use |
|------|-----|
| You need CPU-intensive work (parsing, compression, ML inference, image processing) isolated from the main event loop | `procxy` |
| You want EventEmitter events from a worker class forwarded transparently to the parent process | `procxy` |
| You need to sandbox third-party code so a crash in the library cannot take down the parent | `procxy` |
| You have a class with complex stateful initialization and want to reuse one instance across multiple callers (dedup cache) | `procxy` |
| You need to run the same class concurrently across multiple isolated processes without managing fork logic yourself | `procxy` |
| You are passing a third-party config object as a constructor argument and cannot guarantee it contains no functions | `sanitizeForV8` |
| You need a quick workaround for objects with hidden getters/setters that fail V8 validation | `sanitizeForV8` |

**Avoid when:**

| Don't Use | When | Use Instead |
|-----------|------|-------------|
| `procxy` | Your class holds non-serializable state: closures captured over parent-side objects, WeakMaps, Symbols, or live streams | they do not survive the IPC boundary |
| `procxy` | Sub-millisecond latency is required; IPC adds ~1 ms per round-trip even for trivial calls | — |
| `procxy` | Your method return values include class instances with behavior | they are serialized to plain data and arrive without prototype methods |
| `procxy` | You need the child to call back into parent-side callbacks synchronously inside a proxied method (deadlock risk) | — |
| `sanitizeForV8` | The dropped properties are load-bearing | sanitization silently loses data with no warning |
| `sanitizeForV8` | You control the data shape | fix the type instead of sanitizing |
- API surface: 6 functions, 6 classes, 29 types

**NEVER:**

- NEVER pass functions as constructor arguments — V8 serialization silently drops them; use `sanitizeV8: true` only as a last resort and accept the data loss
- NEVER call `$terminate()` from inside a proxied method's implementation in the child — the IPC response for the current call is never sent, hanging the parent indefinitely
- NEVER assume the cached proxy is always fresh — if the child crashes and you hold a reference, subsequent calls throw `ChildCrashedError`; check `$process.exitCode` before reusing across request boundaries
- NEVER mix `'json'` and `'advanced'` mode on the same class across different `procxy()` calls — they produce separate child processes with separate dedup keys; use one mode consistently
- NEVER set `retries` to a high value for non-idempotent methods — each retry re-sends the full IPC call; the method may execute multiple times if the child is slow but alive
- NEVER rely on sanitized output for equality checks — keys may be missing compared to input
- NEVER use on `Map` or `Set` values that contain functions as keys — those entries are recursively sanitized but not removed

## Troubleshooting

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

## Configuration

**ProcxyOptions** — Configuration for the `procxy()` function.

Controls child process spawning, IPC serialization, timeouts, retries, environment
isolation, and optional handle-passing support. (0 options — see references/config.md)

## Quick Reference

**Core:** `procxy` (Spawn a class instance in an isolated child process and return a transparent async proxy), `Procxy` (The proxy type returned by `procxy()` — a transparent async mirror of a remote class instance)
**Serialization:** `sanitizeForV8` (Strip non-V8-serializable properties from a value, returning a deep-cloned plain version), `sanitizeForV8Array` (Apply sanitizeForV8 to each element of an array, returning a new sanitized array), `V8Serializable` (Union of all types that survive Node)
**Runtime Utilities:** `isProcxy` (Runtime type guard that returns `true` when `obj` is a live Procxy proxy), `isAdvancedMode` (Narrow a proxy's type to `Procxy<T, 'advanced', H>` at runtime), `isHandleSupported` (Narrow a proxy's type to `Procxy<T, 'advanced', true>` when handle passing is enabled)
**Errors:** `ProcxyError` (Base class for all errors thrown by Procxy), `TimeoutError` (Thrown when a proxied method call or the INIT handshake exceeds the configured timeout), `ModuleResolutionError` (Thrown when procxy cannot determine the file path of the class's module), `ChildCrashedError` (Thrown when the child process exits or is killed while the proxy is active), `SerializationError` (Thrown when a constructor argument, method argument, or return value cannot be serialized across the IPC boundary), `OptionsValidationError` (Thrown when a value in ProcxyOptions fails validation before the child process is spawned)
**Configuration:** `SerializationMode` (Serialization mode for IPC messages exchanged between parent and child processes)
**Types:** `Procxiable` (The serializable type constraint for a given IPC mode), `IsProcxiable` (Conditional type that resolves to `true` when `T` can cross the IPC boundary in the given mode), `SerializableConstructorArgs` (Constrain constructor argument types to be serializable under the given mode), `PassableHandle` (Union of OS-level handle types that can be transferred to the child process via `$sendHandle`), `MaybeProxy` (A value that is either the original type `T` or a `Procxy<T>` proxy for it), `Procxify` (Extract only the serializable, non-method properties from a type — the "data shape" of a class)
**shared:** `InitMessage` (Initialization message sent from parent to child on startup), `Request` (Method invocation request sent from parent to child), `Response` (Method invocation response sent from child to parent), `ErrorInfo` (Error information serialized in Response messages), `EventMessage` (Event message sent from child to parent for EventEmitter events), `ParentToChildMessage` (Union type of all IPC messages sent from parent to child), `ChildToParentMessage` (Union type of all IPC messages sent from child to parent), `HandleMessage` (Handle transmission message sent from parent to child), `HandleAck` (Handle acknowledgment sent from child to parent after handle is received)
**Type Utilities:** `UnwrapProcxy` (Extract the original type `T` from `Procxy<T, Mode, SupportHandles>`), `IsProcxy` (Conditional type that resolves to `true` when `P` is a `Procxy` type), `IsProcxyIsomorphic` (Conditional type that resolves to `true` when `T <-> Procxy<T>` form a consistent isomorphism), `GetProcxyMode` (Extract the serialization mode from a `Procxy` type), `HasHandleSupport` (Conditional type that resolves to `true` when `P` has `$sendHandle` support), `ChangeProcxyMode` (Produce a new `Procxy` type identical to `P` except with a different serialization mode), `ToggleProcxyHandles` (Produce a new `Procxy` type identical to `P` except with a different `SupportHandles` flag), `ProcxyIsomorphism` (Describes the bidirectional type mapping between `T` and `Procxy<T>`), `VerifyIsomorphism` (Compile-time assertion that `T` round-trips through `Procxy<T>` without loss), `GetProcxyMethods` (Extract the union of user-defined method names available on a `Procxy` type), `GetProcxyLifecycleMethods` (Extract the lifecycle method and property names from a `Procxy` type)

## References

Load these on demand — do NOT read all at once:

- When calling any function → read `references/functions.md` for full signatures, parameters, and return types
- When using a class → read `references/classes/` for properties, methods, and inheritance
- When defining typed variables or function parameters → read `references/types.md`
- When configuring options → read `references/config.md` for all settings and defaults

## Links

- [Repository](https://github.com/pradeepmouli/procxy)
- Author: Pradeep Mouli <pmouli@mac.com> (https://github.com/pradeepmouli)