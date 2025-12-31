# Enhancement: Complete Advanced Serialization Remaining Phases

**Enhancement ID**: enhance-002
**Branch**: `enhance/002-complete-remaining-phases-2-4-advanced`
**Created**: 2025-12-31
**Priority**: [x] High | [ ] Medium | [ ] Low
**Component**: Type system, API design, documentation
**Status**: [x] Planned | [ ] In Progress | [ ] Complete

## Input
User description: "Complete remaining phases (2-4) of advanced serialization: type system enhancement, handle passing support, and comprehensive documentation"

## Overview
Complete the implementation of advanced serialization support by enhancing the type system (Phase 2), adding handle passing capabilities (Phase 3), and providing comprehensive documentation with examples (Phase 4). This builds on the completed Phase 1 (Core V8 Serialization Support) to deliver a fully-featured, type-safe advanced serialization system.

## Motivation
While Phase 1 enabled V8 structured clone serialization, the remaining phases are essential for:
- **Type Safety**: Ensure compile-time guarantees about which types can be proxied in each mode
- **Advanced Use Cases**: Enable socket/server transfer between processes via handle passing
- **Developer Experience**: Provide comprehensive documentation and examples for adoption
- **API Completeness**: Deliver function overloads and type inference for serialization modes

Without these phases, users would have limited type safety, no handle passing capabilities, and insufficient documentation to effectively use advanced serialization features.

## Proposed Changes

### Phase 2: Type System Enhancement
- Update `Procxy<T, Mode>` type to filter methods based on serialization mode
- Add function overloads to `procxy()` for automatic mode inference
- Create `IsProcxiable<T, Mode>` and `Procxiable<Mode>` utility types
- Export all new type definitions from main index

### Phase 3: Handle Passing Support
- Add `$sendHandle()` method to proxy interface
- Implement handle transmission in IPC client
- Add handle reception logic in child agent
- Create `ProcxyWithHandle<T, Mode>` type for handle-enabled proxies
- Add platform checks for Windows limitations

### Phase 4: Documentation and Examples
- Update README with serialization modes section
- Create examples for each V8-serializable type (Buffer, Map, Set, BigInt, Date, RegExp, Error)
- Add handle passing examples (socket transfer, server delegation)
- Write migration guide from JSON to advanced mode
- Add performance comparison benchmarks

**Files to Modify**:
- `src/types/procxy.ts` - Update Procxy type with mode-aware filtering
- `src/types/options.ts` - Add serialization mode option
- `src/parent/procxy.ts` - Add function overloads, handle support flag
- `src/parent/ipc-client.ts` - Implement $sendHandle method
- `src/child/agent.ts` - Add handle reception logic
- `src/shared/protocol.ts` - Add HandleMessage type
- `README.md` - Add serialization modes documentation
- `examples/` - Create new example files for advanced features
- `index.ts` - Export new types and utilities

**Breaking Changes**: [ ] Yes | [x] No
All changes are additive and backward compatible. Default behavior remains JSON serialization.

## Implementation Plan

**Phase 1: Type System Enhancement**

**Tasks**:
1. [ ] Define `Procxiable<Mode>` and `IsProcxiable<T, Mode>` types in procxy.ts
2. [ ] Update `ProcxiableMethodKeys` to be mode-aware with proper filtering
3. [ ] Update `Procxy<T, Mode>` type definition to use mode-aware method filtering
4. [ ] Add function overloads to `procxy()` for mode inference ('json' vs 'advanced')
5. [ ] Export new type utilities from index.ts
6. [ ] Write unit tests for type inference (using tsd or similar)
7. [ ] Verify type checking works correctly for both modes

**Acceptance Criteria**:
- [ ] `Procxy<T, 'json'>` only exposes methods with JSON-serializable params/returns
- [ ] `Procxy<T, 'advanced'>` exposes methods with V8-serializable params/returns
- [ ] `procxy()` function correctly infers return type based on options.serialization
- [ ] Type errors occur when incompatible types are used in wrong mode
- [ ] All new types are exported and documented

**Phase 2: Handle Passing Support**

**Tasks**:
1. [ ] Add `PassableHandle` type definition (net.Socket, net.Server, dgram.Socket, number)
2. [ ] Create `ProcxyWithHandle<T, Mode>` type extending Procxy with $sendHandle method
3. [ ] Add HandleMessage type to protocol.ts
4. [ ] Implement `$sendHandle()` in IPC client using child.send(message, sendHandle)
5. [ ] Add handle reception in child agent with event listener
6. [ ] Add `supportHandles` option to ProcxyOptions
7. [ ] Add platform checks (warn on Windows if handles used)
8. [ ] Write integration tests for socket and server passing
9. [ ] Test handle ownership transfer semantics

**Acceptance Criteria**:
- [ ] Sockets can be transferred from parent to child process
- [ ] Servers can be transferred and accept connections in child
- [ ] Handle is no longer usable in parent after transfer
- [ ] Platform warnings appear on Windows
- [ ] Tests verify handle functionality on Unix systems
- [ ] Error handling for invalid handles

**Phase 3: Documentation and Examples**

**Tasks**:
1. [ ] Add "Serialization Modes" section to README with comparison table
2. [ ] Create examples/advanced-serialization/ directory
3. [ ] Write example: buffer-processing.ts (Buffer usage)
4. [ ] Write example: bigint-calculations.ts (BigInt usage)
5. [ ] Write example: collection-processing.ts (Map/Set usage)
6. [ ] Write example: socket-transfer.ts (handle passing)
7. [ ] Write example: error-preservation.ts (full Error objects)
8. [ ] Add migration guide from JSON to advanced mode
9. [ ] Create performance benchmark comparing JSON vs advanced
10. [ ] Update API documentation with new types and methods
11. [ ] Add troubleshooting section for common issues

**Acceptance Criteria**:
- [ ] README clearly explains when to use each serialization mode
- [ ] All V8-serializable types have working examples
- [ ] Handle passing example demonstrates socket transfer
- [ ] Migration guide provides step-by-step conversion process
- [ ] Benchmarks show performance characteristics
- [ ] Documentation covers all new API surface

## Testing
- [ ] Unit tests for type utilities and mode-aware filtering
- [ ] Integration tests for handle passing (socket, server transfer)
- [ ] Integration tests verifying all V8-serializable types work
- [ ] Tests for platform-specific behavior (Unix vs Windows)
- [ ] Performance benchmarks comparing JSON vs advanced serialization
- [ ] Edge cases: invalid handles, mode mismatches, type errors
- [ ] All examples run successfully and are tested in CI

## Verification Checklist
- [ ] Phase 2: Type system correctly filters methods per mode
- [ ] Phase 2: Function overloads provide correct type inference
- [ ] Phase 3: Handle passing works for sockets and servers
- [ ] Phase 3: Platform checks prevent invalid operations on Windows
- [ ] Phase 4: README has complete serialization modes documentation
- [ ] Phase 4: All examples are working and well-commented
- [ ] Phase 4: Migration guide is clear and actionable
- [ ] No regressions in existing JSON serialization mode
- [ ] All tests passing (unit, integration, examples)
- [ ] Type checking passes for all example code
- [ ] Documentation reviewed for accuracy

## Notes

### Design Decisions
- **Default Mode**: Keeping 'json' as default ensures backward compatibility
- **Handle API**: Using `$sendHandle()` method rather than implicit detection maintains explicitness
- **Type Safety**: Mode-aware filtering at type level prevents runtime errors
- **Platform Support**: Handle passing only fully supported on Unix-like systems

### Future Considerations
- Stream support could be added as a future enhancement
- Custom serialization methods (serialize/deserialize) for classes
- SharedArrayBuffer support for shared memory scenarios
- Callback proxying to enable function arguments

### Dependencies
- Phase 2 can begin immediately (Phase 1 complete)
- Phase 3 depends on Phase 2 completion (needs types)
- Phase 4 can be worked on in parallel with Phase 3

### Reference
- Full specification: `specs/ENHANCEMENT_SPEC_ADVANCED_SERIALIZATION.md`
- Phase 1 implementation: PR #12 on branch `enhance/001-advanced-serialization-support-v8-structured`

---
*Enhancement created using `/enhance` workflow - See .specify/extensions/workflows/enhance/*
