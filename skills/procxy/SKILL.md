---
name: procxy
description: "Type-safe process-based proxy for Node.js - Run class instances in isolated child processes with full TypeScript support Use when working with proxy, ipc, child-process, process, isolation, worker, eventemitter, type-safe, async, rpc, concurrency."
license: MIT
---

# procxy

Type-safe process-based proxy for Node.js - Run class instances in isolated child processes with full TypeScript support

## When to Use

- Working with proxy, ipc, child-process, process, isolation, worker, eventemitter, type-safe, async, rpc, concurrency
- API surface: 6 functions, 6 classes, 30 types
- See also: - Procxy for the proxy type definition
 - ProcxyOptions for available configuration options
 - https://github.com/pradeepmouli/procxy#readme | Procxy Documentation

## Quick Reference

**procxy:** `procxy`, `Procxy`, `Procxiable`, `IsProcxiable`, `SerializableConstructorArgs`, `PassableHandle`, `Procxify`
**serialization:** `sanitizeForV8`, `sanitizeForV8Array`, `V8Serializable`
**isomorphism:** `isProcxy`, `isAdvancedMode`, `isHandleSupported`, `UnwrapProcxy`, `IsProcxy`, `IsProcxyIsomorphic`, `GetProcxyMode`, `HasHandleSupport`, `ChangeProcxyMode`, `ToggleProcxyHandles`, `ProcxyIsomorphism`, `VerifyIsomorphism`, `GetProcxyMethods`, `GetProcxyLifecycleMethods`, `MaybeProxy`
**errors:** `ProcxyError`, `TimeoutError`, `ModuleResolutionError`, `ChildCrashedError`, `SerializationError`, `OptionsValidationError`
**options:** `ProcxyOptions`, `SerializationMode`
**protocol:** `InitMessage`, `Request`, `Response`, `ErrorInfo`, `EventMessage`, `ParentToChildMessage`, `ChildToParentMessage`, `HandleMessage`, `HandleAck`

## Links

- [Repository](https://github.com/pradeepmouli/procxy)
- Author: Your Name <your.email@example.com>