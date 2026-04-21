# Types & Enums

## Core

### `Procxy`
The proxy type returned by `procxy()` — a transparent async mirror of a remote class instance.
```ts
{ [K in keyof ProcxiableMethods<T, Mode>]: ProcxiableMethods<T, Mode>[K] extends (args: infer A) => infer R ? (args: A) => Promise<Awaited<R>> : never } & ReadonlyProperties<T, Mode> & { $terminate: any; $process: ChildProcess; [dispose]: any; [asyncDispose]: any } & (SupportHandles extends true ? { $sendHandle: any } : {}) & (T extends EventEmitter<infer E> ? E extends Record<string | symbol, any[]> ? { on: any; once: any; off: any; removeListener: any } : { on: any; once: any; off: any; removeListener: any } : T extends EventEmitter ? { on: any; once: any; off: any; removeListener: any } : {})
```

## Configuration

### `SerializationMode`
Serialization mode for IPC messages exchanged between parent and child processes.
```ts
"json" | "advanced"
```

## Serialization

### `V8Serializable`
Union of all types that survive Node.js V8 structured-clone serialization across an IPC boundary.
```ts
Jsonifiable | Buffer | ArrayBuffer | DataView | Int8Array | Uint8Array | Uint8ClampedArray | Int16Array | Uint16Array | Int32Array | Uint32Array | Float32Array | Float64Array | BigInt64Array | BigUint64Array | Map<any, any> | Set<any> | Error | RegExp | bigint | Date | { [key: string]: V8Serializable | undefined } | ReadonlyArray<V8Serializable>
```

## Types

### `Procxiable`
The serializable type constraint for a given IPC mode.
```ts
Mode extends "advanced" ? V8Serializable : Jsonifiable
```

### `IsProcxiable`
Conditional type that resolves to `true` when `T` can cross the IPC boundary in the given mode.
```ts
T extends Procxiable<Mode> | void | undefined | Function ? true : false
```

### `SerializableConstructorArgs`
Constrain constructor argument types to be serializable under the given mode.
```ts
ConstructorParameters<Constructor<T>> extends infer Args extends readonly any[] ? { [K in keyof Args]: ValidateProcxiable<Args[K], Mode> } : never
```

### `PassableHandle`
Union of OS-level handle types that can be transferred to the child process via `$sendHandle`.
```ts
Socket | Server | Socket | number
```

### `MaybeProxy`
A value that is either the original type `T` or a `Procxy<T>` proxy for it.
```ts
T | Procxy<T, any, any>
```

### `Procxify`
Extract only the serializable, non-method properties from a type — the "data shape" of a class.
```ts
{ [K in keyof T as T[K] extends (args: any[]) => any ? never : IsProcxiable<T[K], Mode> extends true ? K : never]: T[K] }
```

## shared

### `InitMessage`
Initialization message sent from parent to child on startup.
Contains module path, class name, constructor arguments, and serialization mode.
**Properties:**
- `type: "INIT"` — Discriminant: always `'INIT'`
- `modulePath: string` — Absolute path to the module file to `import()` in the child process
- `className: string` — Name of the exported class to instantiate in the child process
- `constructorArgs: Jsonifiable[]` — Positional constructor arguments forwarded verbatim to `new ClassName(...args)`
- `serialization: SerializationMode` (optional) — Serialization algorithm to use for subsequent IPC messages; defaults to `'json'`

### `Request`
Method invocation request sent from parent to child.
Includes unique ID for request/response correlation.
**Properties:**
- `id: string` — UUID v4 that pairs this request with its Response
- `type: "CALL"` — Discriminant: always `'CALL'` (only CALL is supported in v1)
- `prop: string` — Name of the method to invoke on the remote class instance
- `args: Jsonifiable[]` — Positional arguments forwarded to the method call

### `Response`
Method invocation response sent from child to parent.
Either contains return value (RESULT) or error information (ERROR).
**Properties:**
- `id: string` — UUID that matches the originating Request.id
- `type: "RESULT" | "ERROR"` — `'RESULT'` on success, `'ERROR'` on thrown exception
- `value: Jsonifiable` (optional) — Serialized return value; present only when `type === 'RESULT'`
- `error: ErrorInfo` (optional) — Serialized error details; present only when `type === 'ERROR'`

### `ErrorInfo`
Error information serialized in Response messages.
Preserves error message, stack trace, name, and optional code.
**Properties:**
- `message: string` — Human-readable error description, copied from `Error.message`
- `stack: string` (optional) — Full stack trace captured in the child process; absent for non-Error throws
- `name: string` — Error class name (e.g., `'TypeError'`, `'RangeError'`), copied from `Error.name`
- `code: string` (optional) — Optional error code (e.g., `'ENOENT'`, `'EACCES'`) for Node.js system errors

### `EventMessage`
Event message sent from child to parent for EventEmitter events.
Forwards events emitted in child to listeners in parent.
**Properties:**
- `type: "EVENT"` — Discriminant: always `'EVENT'`
- `eventName: string` — Name of the EventEmitter event that was emitted in the child
- `args: Jsonifiable[]` — Positional arguments from the `emit(eventName, ...args)` call

### `ParentToChildMessage`
Union type of all IPC messages sent from parent to child.
```ts
InitMessage | Request | DisposeRequest | EventSubscribe | EventUnsubscribe | CallbackResult | CallbackError | PropertyResult | HandleMessage
```

### `ChildToParentMessage`
Union type of all IPC messages sent from child to parent.
```ts
Response | EventMessage | InitSuccess | InitProperties | InitFailure | DisposeResponse | CallbackInvoke | PropertyGet | PropertySet | HandleAck | ChildDispose
```

### `HandleMessage`
Handle transmission message sent from parent to child.
Notifies child that a handle (socket, server, file descriptor) is being sent.
The actual handle is passed separately via Node.js child.send(message, handle).
**Properties:**
- `type: "HANDLE"` — Discriminant: always `'HANDLE'`
- `handleId: string` — Unique identifier used to pair this message with the subsequent HandleAck
- `handleType: "socket" | "server" | "dgram" | "fd"` — Runtime type of the transferred handle, used by the child to route it correctly

### `HandleAck`
Handle acknowledgment sent from child to parent after handle is received.
**Properties:**
- `type: "HANDLE_ACK"` — Discriminant: always `'HANDLE_ACK'`
- `handleId: string` — Matches HandleMessage.handleId of the handle being acknowledged
- `received: boolean` — `true` if the child successfully received and registered the handle
- `error: string` (optional) — Human-readable error description when `received` is `false`

## Type Utilities

### `UnwrapProcxy`
Extract the original type `T` from `Procxy<T, Mode, SupportHandles>`.
```ts
P extends Procxy<infer T, any, any> ? T : never
```

### `IsProcxy`
Conditional type that resolves to `true` when `P` is a `Procxy` type.
```ts
P extends Procxy<any, any, any> ? true : false
```

### `IsProcxyIsomorphic`
Conditional type that resolves to `true` when `T <-> Procxy<T>` form a consistent isomorphism.
```ts
UnwrapProcxy<Procxy<T, Mode, SH>> extends T ? Procxy<T, Mode, SH> extends Procxy<UnwrapProcxy<Procxy<T, Mode, SH>>, Mode, SH> ? true : false : false
```

### `GetProcxyMode`
Extract the serialization mode from a `Procxy` type.
```ts
P extends Procxy<any, infer Mode, any> ? Mode : never
```

### `HasHandleSupport`
Conditional type that resolves to `true` when `P` has `$sendHandle` support.
```ts
P extends Procxy<any, any, infer SH> ? SH extends true ? true : false : false
```

### `ChangeProcxyMode`
Produce a new `Procxy` type identical to `P` except with a different serialization mode.
```ts
P extends Procxy<infer T, any, infer SH> ? Procxy<T, NewMode, SH> : never
```

### `ToggleProcxyHandles`
Produce a new `Procxy` type identical to `P` except with a different `SupportHandles` flag.
```ts
P extends Procxy<infer T, infer Mode, any> ? Procxy<T, Mode, NewSH> : never
```

### `ProcxyIsomorphism`
Describes the bidirectional type mapping between `T` and `Procxy<T>`.

### `VerifyIsomorphism`
Compile-time assertion that `T` round-trips through `Procxy<T>` without loss.
```ts
UnwrapProcxy<Procxy<T, Mode, SH>> extends T ? T : never
```

### `GetProcxyMethods`
Extract the union of user-defined method names available on a `Procxy` type.
```ts
P extends Procxy<any, any, any> ? Exclude<keyof P, symbol | `$${string}`> : never
```

### `GetProcxyLifecycleMethods`
Extract the lifecycle method and property names from a `Procxy` type.
```ts
P extends Procxy<any, any, any> ? Extract<keyof P, `$${string}` | symbol> : never
```
