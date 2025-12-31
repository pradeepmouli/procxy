# Enhancement: Advanced Serialization Support

**Enhancement ID**: enhance-001
**Branch**: `enhance/001-advanced-serialization-support-v8-structured`
**Created**: December 30, 2025
**Priority**: [x] High | [ ] Medium | [ ] Low
**Component**: serialization, parent-proxy, child-proxy, IPC
**Status**: [x] Planned | [ ] In Progress | [ ] Complete

## Input
User description: "Advanced Serialization Support - V8 structured clone for binary data, collections, and handle passing"

## Overview
Enable procxy to support V8's structured clone algorithm for serialization, allowing binary data (Buffer, TypedArray), collections (Map, Set), BigInt, and handle passing (sockets, servers) across process boundaries. This expands beyond the current JSON-only limitation while maintaining type safety through compile-time guarantees.

## Motivation
Currently, procxy restricts all method arguments and return values to JSON-serializable types, which excludes many useful JavaScript types:
- **Binary Data**: Cannot pass Buffer, ArrayBuffer, or TypedArray instances
- **Collections**: Cannot pass Map or Set directly
- **Large Numbers**: BigInt throws serialization errors
- **Error Objects**: Only message/stack preserved, not full Error instances
- **Handle Passing**: Cannot transfer socket or server ownership to child processes

This limitation forces developers to manually serialize/deserialize complex types or avoid using procxy for certain use cases. V8's structured clone algorithm, available via Node.js `serialization: 'advanced'` fork option, natively supports these types.

## Proposed Changes

**Core Changes**:
- Add `serialization?: 'json' | 'advanced'` option to `ProcxyOptions`
- Pass serialization mode to `child_process.fork()` options
- Update validation logic to check V8-serializable types when mode is 'advanced'
- Create type-level constraints: `Procxiable<Mode>`, `IsProcxiable<T, Mode>`, `V8Serializable`
- Update `Procxy<T, Mode>` type to filter methods based on serialization mode
- Add handle passing API via `$sendHandle()` method

**Files to Modify**:
- `src/types/options.ts` - Add serialization mode to ProcxyOptions
- `src/types/procxy.ts` - Add mode-aware Procxy type with type filtering
- `src/shared/serialization.ts` - Add V8 validation logic
- `src/parent/procxy.ts` - Pass serialization to fork(), add function overloads
- `src/parent/ipc-client.ts` - Support child.send() with handles
- `src/child/agent.ts` - Handle message reception with handles
- `src/shared/protocol.ts` - Add HandleMessage type
- `src/index.ts` - Export new types

**Breaking Changes**: [ ] Yes | [x] No
This is backward compatible - `serialization: 'json'` is the default, maintaining existing behavior.

## Implementation Plan

**Phase 1: V8 Serialization Support**

**Tasks**:
1. [ ] Add `serialization: 'json' | 'advanced'` option to ProcxyOptions and pass to fork()
2. [ ] Create V8Serializable, Procxiable<Mode>, IsProcxiable type definitions
3. [ ] Implement isV8Serializable() and validateV8Serializable() runtime validation
4. [ ] Update Procxy<T, Mode> type with method filtering based on mode
5. [ ] Add procxy() function overloads for mode type inference
6. [ ] Write comprehensive tests for Buffer, TypedArray, Map, Set, BigInt, Date, RegExp, Error
7. [ ] Add integration tests verifying end-to-end serialization of all supported types

**Acceptance Criteria**:
- [ ] Can pass Buffer/TypedArray instances when using `serialization: 'advanced'`
- [ ] Can pass Map/Set instances with full fidelity (not converted to arrays)
- [ ] Can pass BigInt values without errors
- [ ] Error instances preserve all enumerable properties (code, errno, syscall, path)
- [ ] Date and RegExp instances maintained as proper objects, not strings
- [ ] Type system correctly filters methods with non-serializable args/returns
- [ ] Existing JSON-mode tests still pass (backward compatibility)
- [ ] All tests pass with >95% code coverage

## Testing
- [ ] Unit tests for isV8Serializable() validation function
- [ ] Unit tests for each V8-serializable type (Buffer, Map, Set, BigInt, etc.)
- [ ] Integration tests for end-to-end advanced serialization mode
- [ ] Type tests verifying Procxy<T, Mode> filters correctly
- [ ] Edge case tests (circular references, mixed types, large data)
- [ ] Performance comparison benchmarks (JSON vs V8 serialization)
- [ ] Error handling tests (unsupported types in advanced mode)

## Verification Checklist
- [ ] Changes implemented as described
- [ ] All new types exported from index.ts
- [ ] Tests written and passing (unit + integration)
- [ ] No regressions in existing JSON mode functionality
- [ ] TypeScript types enforce serialization mode constraints
- [ ] Documentation updated with serialization mode examples
- [ ] README includes new use cases (binary data, collections)

## Notes

**Design Decisions**:
- Default to 'json' mode for backward compatibility
- Use function overloads for type inference rather than generics
- V8 serialization slightly slower than JSON for simple objects, but enables broader type support
- Handle passing (Phase 2) requires separate API due to ownership transfer semantics

**Future Enhancements** (Not in this enhancement):
- Phase 2: Handle passing via `$sendHandle()` method for net.Socket, net.Server, dgram.Socket
- Phase 3: Custom serialization hooks for class instances
- Phase 4: Performance optimizations for large binary data

**References**:
- [Node.js Child Process serialization option](https://nodejs.org/api/child_process.html#child_processforkmodulepath-args-options)
- [V8 Serialization API](https://v8.dev/blog/custom-startup-snapshots)
- Full specification: [ENHANCEMENT_SPEC_ADVANCED_SERIALIZATION.md](../../ENHANCEMENT_SPEC_ADVANCED_SERIALIZATION.md)

---
*Enhancement created using `/speckit.enhance` workflow - See .specify/extensions/workflows/enhance/*
