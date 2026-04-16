# Types & Enums

## Core

### `Procxy`
The proxy type returned by `procxy()` — a transparent async mirror of a remote class instance.
```ts
{ [K in keyof ProcxiableMethods<T, Mode>]: ProcxiableMethods<T, Mode>[K] extends (args: infer A) => infer R ? (args: A) => Promise<Awaited<R>> : never } & ReadonlyProperties<T, Mode> & { $terminate: any; $process: ChildProcess; [dispose]: any; [asyncDispose]: any } & (SupportHandles extends true ? { $sendHandle: any } : {}) & (T extends EventEmitter<infer E> ? E extends Record<string | symbol, any[]> ? { on: any; once: any; off: any; removeListener: any } : { on: any; once: any; off: any; removeListener: any } : T extends EventEmitter ? { on: any; once: any; off: any; removeListener: any } : {})
```

## Configuration

### `ProcxyOptions`
Configuration for the `procxy()` function.

Controls child process spawning, IPC serialization, timeouts, retries, environment
isolation, and optional handle-passing support.
```ts
{ modulePath?: string; args?: [...Jsonifiable[]]; env?: Record<string, string>; cwd?: string; timeout?: number; retries?: number; interleaveOutput?: boolean } & (Mode extends "advanced" ? { serialization: "advanced"; supportHandles?: SupportHandles; sanitizeV8?: boolean } : { serialization?: "json" })
```

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

## protocol

### `InitMessage`
Initialization message sent from parent to child on startup.
Contains module path, class name, constructor arguments, and serialization mode.
**Properties:**
- `type: "INIT"`
- `modulePath: string`
- `className: string`
- `constructorArgs: Jsonifiable[]`
- `serialization: SerializationMode` (optional)

### `Request`
Method invocation request sent from parent to child.
Includes unique ID for request/response correlation.
**Properties:**
- `id: string`
- `type: "CALL"`
- `prop: string`
- `args: Jsonifiable[]`

### `Response`
Method invocation response sent from child to parent.
Either contains return value (RESULT) or error information (ERROR).
**Properties:**
- `id: string`
- `type: "RESULT" | "ERROR"`
- `value: Jsonifiable` (optional)
- `error: ErrorInfo` (optional)

### `ErrorInfo`
Error information serialized in Response messages.
Preserves error message, stack trace, name, and optional code.
**Properties:**
- `message: string`
- `stack: string` (optional)
- `name: string`
- `code: string` (optional)

### `EventMessage`
Event message sent from child to parent for EventEmitter events.
Forwards events emitted in child to listeners in parent.
**Properties:**
- `type: "EVENT"`
- `eventName: string`
- `args: Jsonifiable[]`

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
- `type: "HANDLE"`
- `handleId: string`
- `handleType: "socket" | "server" | "dgram" | "fd"`

### `HandleAck`
Handle acknowledgment sent from child to parent after handle is received.
**Properties:**
- `type: "HANDLE_ACK"`
- `handleId: string`
- `received: boolean`
- `error: string` (optional)

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
