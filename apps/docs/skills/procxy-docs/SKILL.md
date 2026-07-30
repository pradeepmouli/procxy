---
description: Procxy - A TypeScript library for transparent process-based proxy of class instances.
name: procxy-docs
---

# procxy-docs

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

**Use this skill when:**
- You need CPU-intensive work (parsing, compression, ML inference, image processing) isolated from the main event loop → use `procxy` — Node.js is single-threaded; even 50 ms of synchronous compute blocks all in-flight HTTP requests
- You want EventEmitter events from a worker class forwarded transparently to the parent process → use `procxy` — the IPC event bridge handles subscribe/unsubscribe automatically; no manual message routing needed
- You need to sandbox third-party code so a crash or uncaught exception in the library cannot take down the parent → use `procxy` — the child process dies; the parent gets `ChildCrashedError` and keeps running
- You have a class with complex stateful initialization and want to reuse one instance across multiple callers → use `procxy` — the dedup cache coalesces concurrent `procxy()` calls with identical args into a single child process
- You need strict memory isolation between instances → use `procxy` — a memory-leaking worker is confined to its own process heap; it cannot OOM the parent or sibling workers the way a shared in-process worker would
- You are passing a third-party config object as a constructor argument and cannot guarantee it contains no functions → use `sanitizeForV8`
- You need a quick workaround for objects with hidden getters/setters that fail V8 validation → use `sanitizeForV8`

**Do NOT use when:**
- Your class holds non-serializable state: closures captured over parent-side objects, WeakMaps, Symbols, or live streams — they do not survive the IPC boundary (`procxy`)
- Sub-millisecond latency is required; IPC adds ~1 ms per round-trip even for trivial calls (`procxy`)
- Your method return values include class instances with behavior — they are serialized to plain data and arrive without prototype methods (`procxy`)
- You need the child to call back into parent-side callbacks synchronously inside a proxied method (deadlock risk) (`procxy`)
- The dropped properties are load-bearing — sanitization silently loses data with no warning (`sanitizeForV8`)
- You control the data shape — fix the type instead of sanitizing (`sanitizeForV8`)

API surface: 6 functions, 6 classes, 29 types

## NEVER

- NEVER pass functions as constructor arguments — V8 serialization silently drops them; use `sanitizeV8: true` only as a last resort and accept the data loss
- NEVER call `$terminate()` from inside a proxied method's implementation in the child — the IPC response for the current call is never sent, hanging the parent indefinitely
- NEVER assume the cached proxy is always fresh — if the child crashes and you hold a reference, subsequent calls throw `ChildCrashedError`; check `$process.exitCode` before reusing across request boundaries
- NEVER mix `'json'` and `'advanced'` mode on the same class across different `procxy()` calls — they produce separate child processes with separate dedup keys; use one mode consistently
- NEVER set `retries` to a high value for non-idempotent methods — each retry re-sends the full IPC call; the method may execute multiple times if the child is slow but alive
- NEVER rely on sanitized output for equality checks — keys may be missing compared to input
- NEVER use on `Map` or `Set` values that contain functions as keys — those entries are recursively sanitized but not removed

## Configuration

**ProcxyOptions** — Configuration for the `procxy()` function.

Controls child process spawning, IPC serialization, timeouts, retries, environment
isolation, and optional handle-passing support. (0 options — see references/config.md)

## Quick Reference

**Key functions:** `procxy` (Spawn a class instance in an isolated child process and return a transparent async proxy), `sanitizeForV8` (Strip non-V8-serializable properties from a value, returning a deep-cloned plain version), `sanitizeForV8Array` (Apply sanitizeForV8 to each element of an array, returning a new sanitized array), `isProcxy` (Runtime type guard that returns `true` when `obj` is a live Procxy proxy), `isAdvancedMode` (Narrow a proxy's type to `Procxy<T, 'advanced', H>` at runtime), `isHandleSupported` (Narrow a proxy's type to `Procxy<T, 'advanced', true>` when handle passing is enabled)
**Key classes:** `ProcxyError` (Base class for all errors thrown by Procxy), `TimeoutError` (Thrown when a proxied method call or the INIT handshake exceeds the configured timeout), `ModuleResolutionError` (Thrown when procxy cannot determine the file path of the class's module), `ChildCrashedError` (Thrown when the child process exits or is killed while the proxy is active), `SerializationError` (Thrown when a constructor argument, method argument, or return value cannot be serialized across the IPC boundary), `OptionsValidationError` (Thrown when a value in ProcxyOptions fails validation before the child process is spawned)

*41 exports total — see references/ for full API.*

## References

Load these on demand — do NOT read all at once:

- When calling any function → read `references/functions.md` for full signatures, parameters, and return types
- When using a class → read `references/classes.md` for properties, methods, and inheritance
- When defining typed variables or function parameters → read `references/types.md`
- When configuring options → read `references/config.md` for all settings and defaults

## Links

- Author: Pradeep Mouli <pmouli@mac.com> (https://github.com/pradeepmouli)