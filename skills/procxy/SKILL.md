---
name: procxy
description: Procxy - A TypeScript library for transparent process-based proxy of class instances.
license: MIT
---

# procxy

Procxy - A TypeScript library for transparent process-based proxy of class instances.



## Overview

Procxy enables you to run class instances in isolated child processes while interacting
with them as if they were local objects. All method calls become async and are transparently
forwarded over IPC.

## Key Features

- 🎯 **Type-Safe**: Full TypeScript support with IntelliSense
- ⚡ **Fast**: <10ms overhead per method call
- 🔄 **Event Support**: Transparent EventEmitter forwarding
- 🛡️ **Error Handling**: Complete error propagation with stack traces
- 🧹 **Lifecycle**: Automatic cleanup with disposable protocol support
- ⚙️ **Configurable**: Timeouts, retries, custom env/cwd

## Quick Start

```typescript
import { procxy } from 'procxy';

class Calculator {
  add(a: number, b: number) { return a + b; }
}

// Create remote instance
const calc = await procxy(Calculator, './calculator.js');

// Call methods (now async)
const result = await calc.add(5, 3); // 8

// Clean up
await calc.$terminate();
```

## Using Disposables (Recommended)

```typescript
// Automatic cleanup with await using
await using calc = await procxy(Calculator, './calculator.js');
const result = await calc.add(5, 3);
// Automatically terminated when scope exits
```

## When to Use

- Calling `procxy()`, `sanitizeForV8()`, `sanitizeForV8Array()`, `isProcxy()`, `isAdvancedMode()`, and 1 more
- Instantiating or extending `ProcxyError`, `TimeoutError`, `ModuleResolutionError`
- Typing with `Procxy`, `ProcxyOptions`, `SerializationMode`, `V8Serializable`, `Procxiable`
- See also: - Procxy for the proxy type definition
 - ProcxyOptions for available configuration options
 - https://github.com/pradeepmouli/procxy#readme | Procxy Documentation

## Quick Reference

**6 functions** — `procxy`, `sanitizeForV8`, `sanitizeForV8Array`, `isProcxy`, `isAdvancedMode`, `isHandleSupported`
**6 classes** — `ProcxyError`, `TimeoutError`, `ModuleResolutionError`, `ChildCrashedError`, `SerializationError`, `OptionsValidationError`
**30 types** — `Procxy`, `ProcxyOptions`, `SerializationMode`, `V8Serializable`, `Procxiable`, `IsProcxiable`, `SerializableConstructorArgs`, `PassableHandle`, `InitMessage`, `Request`, `Response`, `ErrorInfo`, `EventMessage`, `ParentToChildMessage`, `ChildToParentMessage`, `HandleMessage`, `HandleAck`, `UnwrapProcxy`, `IsProcxy`, `IsProcxyIsomorphic`, `GetProcxyMode`, `HasHandleSupport`, `ChangeProcxyMode`, `ToggleProcxyHandles`, `ProcxyIsomorphism`, `VerifyIsomorphism`, `GetProcxyMethods`, `GetProcxyLifecycleMethods`, `MaybeProxy`, `Procxify`

## Links

- [Repository](https://github.com/pradeepmouli/procxy)
- Author: Your Name <your.email@example.com>