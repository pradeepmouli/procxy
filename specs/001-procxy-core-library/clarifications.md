# Clarification Document: Procxy Core Library

**Feature**: 001-procxy-core-library
**Date**: 2025-12-27
**Status**: Clarifications Requested

## Issues Requiring Clarification

### 1. Module Path Detection Strategy
**Location**: FR-009, FR-016, modulePath option
**Current State**: Specification mentions determining module path from constructor but doesn't specify the mechanism.

**Ambiguity**:
- How is the module path extracted from the constructor?
- What's the fallback when auto-detection fails?
- Should we use `constructor.toString()`, source maps, or module cache inspection?

**Questions for User**:
- Is the `modulePath` option mandatory or optional?
- If optional, what's the preferred auto-detection method?
- Should the library throw an error or try multiple strategies?

**Proposed Resolution**:
- [ ] Require explicit `modulePath` in options (simpler implementation)
- [ ] Auto-detect using stack inspection + source maps (more ergonomic)
- [ ] Support both with fallback (most flexible)

---

### 2. Constructor Arguments Handling
**Location**: FR-009, ProcxyOptions.constructorArgs
**Current State**: Specification mentions `constructorArgs` but doesn't clarify how they're passed or validated.

**Ambiguity**:
- Are constructorArgs always serializable JSON?
- What happens if a constructorArg is a function or non-serializable object?
- Are constructorArgs passed to the same constructor as the parent, or does the child instantiate differently?

**Questions for User**:
- Should constructorArgs be serializable only, or support custom serialization?
- If the constructor has required args, should procxy enforce them?
- Example: `new Calculator(precision: number = 2)` - does procxy need to know default values?

**Proposed Resolution**:
- [ ] Only support JSON-serializable types for constructorArgs
- [ ] Document that non-serializable args must be set up separately in the child
- [ ] Use same constructor call in both parent (type extraction) and child (instantiation)

---

### 3. Property Access vs Method Calls
**Location**: Procxy<T> type definition
**Current State**: Type definition currently only supports methods, not properties.

**Ambiguity**:
- Should property access be supported? (e.g., `proxy.config.timeout`)
- Should setters be supported? (e.g., `proxy.name = 'new name'`)
- Or is the API methods-only?

**Questions for User**:
- Is property access required or is methods-only sufficient for MVP?
- Should readonly properties be exposed?
- What about properties that are objects (nested access)?

**Proposed Resolution**:
- [ ] Methods only for MVP (current spec)
- [ ] Add support for read-only property access via getter methods
- [ ] Support property setters via special `$set` method

---

### 4. Error Stack Trace Preservation
**Location**: FR-005, Error Handling
**Current State**: Specification mentions preserving stack traces but doesn't specify how much of the child's stack is meaningful.

**Ambiguity**:
- Should the full child process stack be included in the parent error?
- Does the parent stack (parent proxy calling → IPC transport → wait for response) matter?
- How do we format mixed parent/child stack traces?

**Questions for User**:
- Should error stacks show both parent and child frames?
- Or only the child frames where the error actually occurred?
- Example format preference?

**Proposed Resolution**:
- [ ] Child stack only (cleaner, less confusing)
- [ ] Parent stack + Child stack (more debugging info)
- [ ] Child stack with parent note at bottom

---

### 5. Timeout Behavior at Method Call Time
**Location**: FR-011, ProcxyOptions.timeout
**Current State**: Timeout exists but unclear what happens when it fires.

**Ambiguity**:
- When timeout fires, does the child process continue executing or is it killed?
- Does timeout apply per-method-call or is it global?
- Can individual method calls override the default timeout?

**Questions for User**:
- Should calling a slow method kill the child process?
- Or just reject the promise and let the method complete in background?
- Can users override timeout per-call: `await proxy.slowMethod(arg, { timeout: 60000 })`?

**Proposed Resolution**:
- [ ] Per-call timeout only, rejects promise but child continues
- [ ] Global timeout per instance
- [ ] Support both: global default + per-call override

---

### 6. Child Process Exit Behavior
**Location**: FR-012, FR-007, Lifecycle Management
**Current State**: Specification mentions cleanup but not all exit scenarios.

**Ambiguity**:
- What happens if child crashes/exits unexpectedly?
- Should pending method calls reject or timeout?
- Can the child be restarted automatically?
- What about orphaned processes if parent dies uncleanly?

**Questions for User**:
- Auto-restart on crash, or fail fast?
- Automatic cleanup on parent exit, or manual required?
- Should there be a health check mechanism?

**Proposed Resolution**:
- [ ] Fail fast on child crash (simpler)
- [ ] Auto-restart with max attempt count
- [ ] Support both with option

---

### 7. Type Safety for Dynamic Properties
**Location**: Procxy<T>, Type Definitions
**Current State**: Assumes constructor is fully typed, but doesn't address inheritance or complex class hierarchies.

**Ambiguity**:
- How does procxy handle inherited methods from parent classes?
- What about abstract classes or interfaces?
- Does Procxy<Calculator> expose private members in types?

**Questions for User**:
- Should only public methods/properties be exposed?
- How to handle methods from base classes?
- Is reflection needed to discover public API at runtime?

**Proposed Resolution**:
- [ ] Expose entire public API via Procxy<T> mapping
- [ ] Exclude private members (using #prefix convention)
- [ ] Validate at runtime that properties exist before calling

---

## Summary of Clarifications Needed

| Issue | Priority | Impact | Proposed Next Step |
|-------|----------|--------|-------------------|
| Module path detection | HIGH | Core functionality | Get user's preferred approach |
| Constructor args handling | HIGH | Core functionality | Clarify serialization strategy |
| Property access support | MEDIUM | API completeness | Determine if methods-only is sufficient |
| Error stack formatting | MEDIUM | Developer experience | Define expected format |
| Timeout behavior | MEDIUM | Error handling | Clarify kill vs reject semantics |
| Child exit handling | MEDIUM | Reliability | Determine restart policy |
| Type safety approach | LOW | Type inference | Document inheritance handling |

---

## Next Steps

1. Review clarifications with user
2. Update specification based on resolutions
3. Proceed to planning phase once ambiguities are resolved
