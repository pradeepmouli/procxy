# Types & Enums

## Types

### `Procxy`
Procxy<T, Mode> — The proxy type that wraps a remote object instance.

All methods of T are transformed to async (returning Promise<ReturnType>).
Only methods with serializable parameters and return values are included.
The serialization constraint depends on the Mode parameter:
- 'json' (default): JSON-serializable types only (primitive, objects, arrays)
- 'advanced': V8-serializable types (includes Buffer, TypedArray, Map, Set, BigInt, etc.)

Properties are included as read-only - they can be read but not set from the parent.
To modify properties, use methods provided by the child class.

Special lifecycle methods are prefixed with $ to avoid conflicts:
- $terminate(): Explicitly terminates the child process
- $process: Access to the underlying ChildProcess instance

Disposable Protocol:
- [Symbol.dispose](): Synchronously terminate (calls $terminate() but doesn't await)
- [Symbol.asyncDispose](): Asynchronously terminate (awaits $terminate())
- Enables `using` and `await using` statements for automatic cleanup

If T extends EventEmitter<E>, the proxy also extends EventEmitter<E> with typed methods:
- .on(event, listener)
- .once(event, listener)
- .off(event, listener)
- .removeListener(event, listener)
Note: .emit() is not available on the proxy; events originate from the child.
```ts
{ [K in keyof ProcxiableMethods<T, Mode>]: ProcxiableMethods<T, Mode>[K] extends (args: infer A) => infer R ? (args: A) => Promise<Awaited<R>> : never } & ReadonlyProperties<T, Mode> & { $terminate: any; $process: ChildProcess; [dispose]: any; [asyncDispose]: any } & (SupportHandles extends true ? { $sendHandle: any } : {}) & (T extends EventEmitter<infer E> ? E extends Record<string | symbol, any[]> ? { on: any; once: any; off: any; removeListener: any } : { on: any; once: any; off: any; removeListener: any } : T extends EventEmitter ? { on: any; once: any; off: any; removeListener: any } : {})
```

### `ProcxyOptions`
Configuration options for procxy() function.

Allows fine-grained control over child process creation, timeouts, and module resolution.
```ts
{ modulePath?: string; args?: [...Jsonifiable[]]; env?: Record<string, string>; cwd?: string; timeout?: number; retries?: number; interleaveOutput?: boolean } & (Mode extends "advanced" ? { serialization: "advanced"; supportHandles?: SupportHandles; sanitizeV8?: boolean } : { serialization?: "json" })
```

### `SerializationMode`
Serialization mode for IPC messages.
- 'json': JSON serialization (default, backward compatible)
- 'advanced': V8 structured clone algorithm (supports Buffer, Map, Set, BigInt, etc.)
```ts
"json" | "advanced"
```

### `V8Serializable`
Types that are serializable with V8 structured clone algorithm.
This includes all JSON-serializable types plus additional V8-specific types.
```ts
Jsonifiable | Buffer | ArrayBuffer | DataView | Int8Array | Uint8Array | Uint8ClampedArray | Int16Array | Uint16Array | Int32Array | Uint32Array | Float32Array | Float64Array | BigInt64Array | BigUint64Array | Map<any, any> | Set<any> | Error | RegExp | bigint | Date | { [key: string]: V8Serializable | undefined } | ReadonlyArray<V8Serializable>
```

### `Procxiable`
Get the serializable type constraint based on the serialization mode.
- 'json' mode: Jsonifiable types only
- 'advanced' mode: V8Serializable types (includes Buffer, Map, Set, BigInt, etc.)
```ts
Mode extends "advanced" ? V8Serializable : Jsonifiable
```

### `IsProcxiable`
Check if a type is procxiable (serializable) for the given mode.
Also handles void, undefined, and Function types (callbacks).
```ts
T extends Procxiable<Mode> | void | undefined | Function ? true : false
```

### `SerializableConstructorArgs`
Constrain constructor arguments to be serializable based on the mode.
Enforces that all constructor args must be Procxiable<Mode> and produces errors if not.
```ts
ConstructorParameters<Constructor<T>> extends infer Args extends readonly any[] ? { [K in keyof Args]: ValidateProcxiable<Args[K], Mode> } : never
```

### `PassableHandle`
Types that can be passed as handles to child processes.
These are transferred (not cloned) to the child.

Supported handle types:
- net.Socket: TCP/IPC sockets
- net.Server: TCP/IPC servers
- dgram.Socket: UDP sockets
- number: File descriptors (Unix only)
```ts
Socket | Server | Socket | number
```

### `InitMessage`
Initialization message sent from parent to child on startup.
Contains module path, class name, constructor arguments, and serialization mode.

### `Request`
Method invocation request sent from parent to child.
Includes unique ID for request/response correlation.

### `Response`
Method invocation response sent from child to parent.
Either contains return value (RESULT) or error information (ERROR).

### `ErrorInfo`
Error information serialized in Response messages.
Preserves error message, stack trace, name, and optional code.

### `EventMessage`
Event message sent from child to parent for EventEmitter events.
Forwards events emitted in child to listeners in parent.

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

### `HandleAck`
Handle acknowledgment sent from child to parent after handle is received.

### `UnwrapProcxy`
Extract the original type T from Procxy<T, Mode, SupportHandles>.
This is the inverse operation of applying Procxy<T>.
```ts
P extends Procxy<infer T, any, any> ? T : never
```

### `IsProcxy`
Check if a type is a Procxy type.
```ts
P extends Procxy<any, any, any> ? true : false
```

### `IsProcxyIsomorphic`
Compile-time check that T <-> Procxy<T> form an isomorphism.
Returns true when forward (T -> Procxy<T>) and backward (Procxy<T> -> T) mappings are consistent.
```ts
UnwrapProcxy<Procxy<T, Mode, SH>> extends T ? Procxy<T, Mode, SH> extends Procxy<UnwrapProcxy<Procxy<T, Mode, SH>>, Mode, SH> ? true : false : false
```

### `GetProcxyMode`
Get the serialization mode from a Procxy type.
```ts
P extends Procxy<any, infer Mode, any> ? Mode : never
```

### `HasHandleSupport`
Check if a Procxy type has handle support enabled.
```ts
P extends Procxy<any, any, infer SH> ? SH extends true ? true : false : false
```

### `ChangeProcxyMode`
Recreate a Procxy type with a different serialization mode.
Useful for converting between 'json' and 'advanced' modes while preserving the underlying type.
```ts
P extends Procxy<infer T, any, infer SH> ? Procxy<T, NewMode, SH> : never
```

### `ToggleProcxyHandles`
Enable or disable handle support on a Procxy type.
```ts
P extends Procxy<infer T, infer Mode, any> ? Procxy<T, Mode, NewSH> : never
```

### `ProcxyIsomorphism`
Bidirectional mapping between T and Procxy<T>.
Demonstrates the isomorphism property.

### `VerifyIsomorphism`
Verify that the forward and backward mappings form an isomorphism.
This type will resolve to T if the isomorphism holds, otherwise never.
```ts
UnwrapProcxy<Procxy<T, Mode, SH>> extends T ? T : never
```

### `GetProcxyMethods`
Extract method names that are procxiable (available on the proxy).
These are the methods that will be present on Procxy<T>.
```ts
P extends Procxy<any, any, any> ? Exclude<keyof P, symbol | `$${string}`> : never
```

### `GetProcxyLifecycleMethods`
Extract lifecycle methods from Procxy type.
These are the special methods prefixed with $ or symbols.
```ts
P extends Procxy<any, any, any> ? Extract<keyof P, `$${string}` | symbol> : never
```

### `MaybeProxy`
Type utilities for working with the isomorphism between T and Procxy<T>.

These utilities enable bidirectional type mapping and introspection:
- UnwrapProcxy: Extract T from Procxy<T>
- IsProcxy: Check if a type is a Procxy type
- IsProcxyIsomorphic: Compile-time verification that T <-> Procxy<T> form an isomorphism
- ProcxyIsomorphism: Demonstrate the bidirectional mapping
- ChangeProcxyMode: Convert between serialization modes
- VerifyIsomorphism: Compile-time verification of the isomorphism
- MaybeProxy: Type representing either T or Procxy<T>
- Procxify: Extract procxiable properties from an object type
```ts
T | Procxy<T, any, any>
```

### `Procxify`
Shallow procxiable subset of an object.
Picks only non-method properties whose values can be sent across the wire for the given mode.
Does not transform methods or recurse; intended to mirror type-fest's Jsonify utility for procxiable data.
```ts
{ [K in keyof T as T[K] extends (args: any[]) => any ? never : IsProcxiable<T[K], Mode> extends true ? K : never]: T[K] }
```
