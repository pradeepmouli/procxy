---
name: procxy-docs
description: Documentation site for procxy
---

# procxy-docs

Documentation site for procxy

## When to Use

- API surface: 6 functions, 6 classes, 30 types

## Quick Reference

**Core:** `procxy`, `Procxy`
**Serialization:** `sanitizeForV8`, `sanitizeForV8Array`, `V8Serializable`
**Runtime Utilities:** `isProcxy`, `isAdvancedMode`, `isHandleSupported`
**Errors:** `ProcxyError`, `TimeoutError`, `ModuleResolutionError`, `ChildCrashedError`, `SerializationError`, `OptionsValidationError`
**Configuration:** `ProcxyOptions`, `SerializationMode`
**Types:** `Procxiable`, `IsProcxiable`, `SerializableConstructorArgs`, `PassableHandle`, `MaybeProxy`, `Procxify`
**protocol:** `InitMessage`, `Request`, `Response`, `ErrorInfo`, `EventMessage`, `ParentToChildMessage`, `ChildToParentMessage`, `HandleMessage`, `HandleAck`
**Type Utilities:** `UnwrapProcxy`, `IsProcxy`, `IsProcxyIsomorphic`, `GetProcxyMode`, `HasHandleSupport`, `ChangeProcxyMode`, `ToggleProcxyHandles`, `ProcxyIsomorphism`, `VerifyIsomorphism`, `GetProcxyMethods`, `GetProcxyLifecycleMethods`

## Links

- Author: Pradeep Mouli <pmouli@mac.com> (https://github.com/pradeepmouli)