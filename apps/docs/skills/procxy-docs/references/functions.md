# Functions

## Core

### `procxy`
Spawn a class instance in an isolated child process and return a transparent async proxy.

Uses Node.js `child_process.fork()` to create a dedicated process for the class instance.
All method calls on the returned proxy are serialized, forwarded over IPC, and the result
is sent back — adding roughly 1 ms round-trip overhead per call. The same call signature
is supported in five forms: with/without a module path string, with/without options, and
with/without constructor arguments. Concurrent calls to `procxy()` with identical arguments
are deduplicated: only one child is spawned and subsequent callers receive the same proxy.
Completed proxies are cached with LRU eviction (max 100 entries) so sequential calls also
skip re-spawning, until the child process terminates.
```ts
procxy<T, C, M, SH>(className: keyof T, modulePathOrOptions?: string | ProcxyOptions<M, SH>, options?: ProcxyOptions<M, SH>, constructorArgs: T[keyof T] extends Constructor<any> ? ValidateProcxiable<any, M>[] : never): Promise<T[C] extends Constructor<U> ? Procxy<U, M, SH> : never>
```
**Parameters:**
- `className: keyof T`
- `modulePathOrOptions: string | ProcxyOptions<M, SH>` (optional) — Path to the module file that exports the class, or a ProcxyOptions object when omitting a separate path
- `options: ProcxyOptions<M, SH>` (optional) — ProcxyOptions when the second argument is a module path string
- `constructorArgs: T[keyof T] extends Constructor<any> ? ValidateProcxiable<any, M>[] : never` — Arguments forwarded to the class constructor; must be JSON-serializable in `'json'` mode or V8-serializable in `'advanced'` mode
**Returns:** `Promise<T[C] extends Constructor<U> ? Procxy<U, M, SH> : never>` — A `Procxy<T>` proxy whose methods are all async and whose read-only properties mirror the child instance
**Throws:** When the INIT handshake does not complete within the configured `timeout`


- You need CPU-intensive work (parsing, compression, ML inference, image processing) isolated from the main event loop
- You want EventEmitter events from a worker class forwarded transparently to the parent process
- You need to sandbox third-party code so a crash in the library cannot take down the parent
- You have a class with complex stateful initialization and want to reuse one instance across multiple callers (dedup cache)
- You need to run the same class concurrently across multiple isolated processes without managing fork logic yourself


- Your class holds non-serializable state: closures captured over parent-side objects, WeakMaps, Symbols, or live streams — they do not survive the IPC boundary
- Sub-millisecond latency is required; IPC adds ~1 ms per round-trip even for trivial calls
- Your method return values include class instances with behavior — they are serialized to plain data and arrive without prototype methods
- You need the child to call back into parent-side callbacks synchronously inside a proxied method (deadlock risk)


- NEVER pass functions as constructor arguments — V8 serialization silently drops them; use `sanitizeV8: true` only as a last resort and accept the data loss
- NEVER call `$terminate()` from inside a proxied method's implementation in the child — the IPC response for the current call is never sent, hanging the parent indefinitely
- NEVER assume the cached proxy is always fresh — if the child crashes and you hold a reference, subsequent calls throw `ChildCrashedError`; check `$process.exitCode` before reusing across request boundaries
- NEVER mix `'json'` and `'advanced'` mode on the same class across different `procxy()` calls — they produce separate child processes with separate dedup keys; use one mode consistently
- NEVER set `retries` to a high value for non-idempotent methods — each retry re-sends the full IPC call; the method may execute multiple times if the child is slow but alive
**See:** - Procxy — proxy type returned by this function
 - ProcxyOptions — full configuration reference
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
// Basic usage — automatic module path detection
import { procxy } from 'procxy';
import { Calculator } from './calculator.js';

await using calc = await procxy(Calculator);
const result = await calc.add(5, 7); // 12
// Child terminates automatically when the block exits
```
```typescript
// CPU-intensive worker with constructor args and custom options
import { procxy } from 'procxy';
import { ImageProcessor } from './image-processor.js';

const processor = await procxy(
  ImageProcessor,
  './image-processor.js',
  { timeout: 60_000, retries: 1, serialization: 'advanced' } as const,
  { quality: 80, format: 'webp' }  // constructor arg — plain object, no functions
);

const thumbnail = await processor.resize(imageBuffer, 200, 200);
await processor.$terminate();
```
```typescript
// EventEmitter forwarding
import { procxy } from 'procxy';
import { LogWatcher } from './log-watcher.js';

const watcher = await procxy(LogWatcher, './log-watcher.js');
watcher.on('line', (text: string) => console.log('[child]', text));
await watcher.start('/var/log/syslog');
// Lines emitted by the child arrive here via IPC event bridge
```

## Serialization

### `sanitizeForV8`
Strip non-V8-serializable properties from a value, returning a deep-cloned plain version.

Performs a recursive walk of the object graph and drops anything that cannot cross the IPC
boundary: functions, getter-only properties, and class instances with custom prototypes
(other than `Date`, `RegExp`, `Error`, `Buffer`, `ArrayBuffer`, `TypedArray`, `Map`, `Set`).
Circular references are replaced with the string `'[Circular]'`.

The sanitization is intentionally lossy: dropped properties are gone without warning. This
is appropriate as a last-resort safety net for configuration objects sourced from third-party
libraries, but for application data it is better to fix the types at the source.

Enable automatic sanitization of constructor arguments via `sanitizeV8: true` in
ProcxyOptions. Sanitization in that context is lazy — it only runs when initial
validation fails, so there is no overhead for objects that are already clean.
```ts
sanitizeForV8(value: unknown, seen: WeakSet<object>): any
```
**Parameters:**
- `value: unknown` — The value to sanitize; primitives are returned as-is
- `seen: WeakSet<object>` — default: `...` — Internal `WeakSet` used for circular-reference tracking; callers should omit this
**Returns:** `any` — A new, plain-object copy of `value` with all non-serializable properties removed


- You are passing a third-party config object as a constructor argument and cannot guarantee it contains no functions
- You need a quick workaround for objects with hidden getters/setters that fail V8 validation


- The dropped properties are load-bearing — sanitization silently loses data with no warning
- You control the data shape — fix the type instead of sanitizing


- NEVER rely on sanitized output for equality checks — keys may be missing compared to input
- NEVER use on `Map` or `Set` values that contain functions as keys — those entries are recursively sanitized but not removed
**See:** - sanitizeForV8Array — sanitize an array of values in one call
 - V8Serializable — the type constraint sanitization produces
```typescript
import { sanitizeForV8 } from 'procxy';

const config = {
  data: 'hello',
  handler: () => {},       // dropped — function
  nested: {
    value: 42,
    method: () => {}       // dropped — function
  }
};

const sanitized = sanitizeForV8(config);
// Result: { data: 'hello', nested: { value: 42 } }
```

### `sanitizeForV8Array`
Apply sanitizeForV8 to each element of an array, returning a new sanitized array.

Shares a single `WeakSet` circular-reference guard across all elements, so cross-element
circular references are also caught. Used internally by `procxy()` when `sanitizeV8: true`
is set in ProcxyOptions and constructor-argument validation fails.
```ts
sanitizeForV8Array(values: unknown[], seen: WeakSet<object>): any[]
```
**Parameters:**
- `values: unknown[]` — Array of values to sanitize; each element is processed independently
- `seen: WeakSet<object>` — default: `...` — Internal `WeakSet` for circular-reference tracking; callers should omit this
**Returns:** `any[]` — New array where each element has had non-V8-serializable properties stripped
**See:** sanitizeForV8 — single-value variant
```typescript
import { sanitizeForV8Array } from 'procxy';

const args = [
  { config: true, handler: () => {} },
  { value: 42 }
];
const sanitized = sanitizeForV8Array(args);
// Result: [{ config: true }, { value: 42 }]
```

## Runtime Utilities

### `isProcxy`
Runtime type guard that returns `true` when `obj` is a live Procxy proxy.

Detection is duck-typed: the function checks for the presence of `$terminate` (function)
and `$process` (object) on the value. This is reliable for procxy-created proxies but
could yield a false positive for hand-crafted objects that happen to have those properties.
```ts
isProcxy<T>(obj: MaybeProxy<T>): obj is Procxy<T, any, any>
```
**Parameters:**
- `obj: MaybeProxy<T>` — A value that is either the original type `T` or a `Procxy<T>`
**Returns:** `obj is Procxy<T, any, any>` — `true` when `obj` has the Procxy lifecycle interface
**See:** isAdvancedMode — check whether a proxy uses advanced serialization
```typescript
import { procxy, isProcxy } from 'procxy';
import { Calculator } from './calculator.js';

function processWorker(worker: Calculator | Procxy<Calculator>) {
  if (isProcxy(worker)) {
    console.log('Remote proxy, PID:', worker.$process.pid);
  } else {
    console.log('Local instance');
  }
}
```

### `isAdvancedMode`
Narrow a proxy's type to `Procxy<T, 'advanced', H>` at runtime.

Calls the internal `$getSerializationMode()` method that every proxy exposes.
If the proxy was created with `serialization: 'advanced'`, this returns `true` and
the TypeScript type is narrowed accordingly — useful when you receive a `Procxy<T, any, H>`
and need to call a method that only accepts advanced-mode proxies.
```ts
isAdvancedMode<T, H>(proxy: Procxy<T, any, H>): proxy is Procxy<T, "advanced", H>
```
**Parameters:**
- `proxy: Procxy<T, any, H>` — Any `Procxy` instance
**Returns:** `proxy is Procxy<T, "advanced", H>` — `true` when the proxy was spawned with `serialization: 'advanced'`
**See:** - isProcxy — check whether any value is a proxy at all
 - isHandleSupported — check whether the proxy can send OS handles
```typescript
import { procxy, isAdvancedMode } from 'procxy';
import { Worker } from './worker.js';

const w = await procxy(Worker, { serialization: 'advanced' } as const);
if (isAdvancedMode(w)) {
  // TypeScript now knows w is Procxy<Worker, 'advanced', false>
  console.log('Can send Buffers');
}
```

### `isHandleSupported`
Narrow a proxy's type to `Procxy<T, 'advanced', true>` when handle passing is enabled.

Calls the internal `$isHandleSupported()` method. Returns `true` only when the proxy
was created with both `serialization: 'advanced'` and `supportHandles: true`. After
narrowing, the `$sendHandle` method is available on the proxy type.
```ts
isHandleSupported<T, H>(proxy: Procxy<T, any, H>): proxy is Procxy<T, "advanced", true>
```
**Parameters:**
- `proxy: Procxy<T, any, H>` — Any `Procxy` instance
**Returns:** `proxy is Procxy<T, "advanced", true>` — `true` when `$sendHandle` is available on this proxy
**See:** - isAdvancedMode — check serialization mode without handle support
 - PassableHandle — types accepted by `$sendHandle`
```typescript
import { procxy, isHandleSupported } from 'procxy';
import net from 'net';
import { SocketHandler } from './socket-handler.js';

const handler = await procxy(SocketHandler, {
  serialization: 'advanced',
  supportHandles: true
} as const);

if (isHandleSupported(handler)) {
  // TypeScript knows $sendHandle is available
  const socket = new net.Socket();
  socket.connect(8080, 'localhost');
  await handler.$sendHandle(socket);
}
```
