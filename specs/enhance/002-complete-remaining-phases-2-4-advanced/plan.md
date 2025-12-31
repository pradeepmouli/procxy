# Implementation Plan: Complete Advanced Serialization Remaining Phases

## Overview

This plan completes Phases 2-4 of the Advanced Serialization enhancement, building on the completed Phase 1 (Core V8 Serialization Support). The implementation delivers type-safe serialization mode support, handle passing capabilities, and comprehensive documentation.

## Tech Stack

### Core Technologies
- **TypeScript 5.x**: Advanced type system features for mode-aware filtering
- **Node.js**: IPC primitives for handle passing (child_process.send with sendHandle)
- **Vitest**: Testing framework for unit and integration tests

### Key Libraries
- **type-fest**: Base Jsonifiable type utilities
- **@types/node**: Type definitions for net, dgram modules

## Architecture

### Type System Architecture

```
┌─────────────────────────────────────────────────────────┐
│ Type Layer                                              │
│                                                         │
│  SerializationMode = 'json' | 'advanced'               │
│           │                                             │
│           ├─> Procxiable<Mode>                         │
│           │    ├─> 'json': Jsonifiable                 │
│           │    └─> 'advanced': V8Serializable          │
│           │                                             │
│           └─> IsProcxiable<T, Mode>                    │
│                (Type predicate)                         │
│                                                         │
│  ProcxiableMethodKeys<T, Mode>                         │
│  (Filters methods based on Mode)                       │
│           │                                             │
│           └─> Procxy<T, Mode>                          │
│                (Final proxy type)                       │
└─────────────────────────────────────────────────────────┘
```

### Handle Passing Architecture

```
┌─────────────────────────────────────────────────────────┐
│ Parent Process                                          │
│                                                         │
│  Proxy Instance                                         │
│       │                                                 │
│       └─> $sendHandle(handle) ──┐                      │
│                                  │                      │
└──────────────────────────────────┼──────────────────────┘
                                   │
                                   │ child.send(msg, handle)
                                   │
┌──────────────────────────────────▼──────────────────────┐
│ Child Process                                           │
│                                                         │
│  process.on('message', (msg, handle) => {              │
│    if (msg.type === 'handle') {                        │
│      handleRegistry.set(msg.id, handle);               │
│    }                                                    │
│  })                                                     │
└─────────────────────────────────────────────────────────┘
```

## File Structure

### Phase 2: Type System Enhancement
```
src/
├── types/
│   ├── procxy.ts       # Add Procxiable<Mode>, IsProcxiable<T, Mode>
│   │                   # Update ProcxiableMethodKeys, Procxy<T, Mode>
│   └── options.ts      # Add serialization?: SerializationMode
│
├── parent/
│   └── procxy.ts       # Add function overloads for mode inference
│
└── index.ts            # Export new type utilities
```

### Phase 3: Handle Passing Support
```
src/
├── types/
│   ├── procxy.ts       # Add PassableHandle, ProcxyWithHandle<T, Mode>
│   └── options.ts      # Add supportHandles?: boolean
│
├── parent/
│   ├── procxy.ts       # Add supportHandles flag handling
│   └── ipc-client.ts   # Implement $sendHandle method
│
├── child/
│   └── agent.ts        # Add handle reception logic
│
└── shared/
    └── protocol.ts     # Add HandleMessage type
```

### Phase 4: Documentation and Examples
```
README.md               # Add Serialization Modes section
examples/
└── advanced-serialization/
    ├── README.md       # Overview and setup
    ├── buffer-processing.ts
    ├── bigint-calculations.ts
    ├── collection-processing.ts
    ├── socket-transfer.ts
    ├── error-preservation.ts
    └── migration-guide.md

benchmark/
└── serialization-modes.ts  # JSON vs Advanced performance
```

### Testing Structure
```
tests/
├── integration/
│   ├── handle-passing.test.ts      # Socket/server transfer tests
│   └── type-inference.test.ts      # Mode-aware type filtering
│
└── unit/
    └── type-predicates.test.ts     # IsProcxiable validation
```

## Implementation Phases

### Phase 2: Type System Enhancement (Priority: High, Duration: 1-2 days)

**Goal**: Enable compile-time type safety for serialization modes

**Steps**:
1. Define `Procxiable<Mode>` type that switches between Jsonifiable and V8Serializable
2. Create `IsProcxiable<T, Mode>` type predicate for validation
3. Update `ProcxiableMethodKeys<T, Mode>` to filter based on mode
4. Update `Procxy<T, Mode>` to use mode-aware filtering
5. Add function overloads to `procxy()` for automatic type inference
6. Export all new types from index.ts
7. Add type tests to verify correct inference

**Dependencies**: None (Phase 1 complete)

**Validation**:
- TypeScript compiler shows errors for incompatible types in wrong mode
- Function overloads correctly infer Procxy<T, 'json'> or Procxy<T, 'advanced'>
- All existing tests pass without modification

### Phase 3: Handle Passing Support (Priority: Medium, Duration: 2-3 days)

**Goal**: Enable transferring sockets/servers between processes

**Steps**:
1. Define `PassableHandle` type union
2. Create `ProcxyWithHandle<T, Mode>` extending Procxy
3. Add `HandleMessage` to protocol.ts
4. Implement `$sendHandle()` in IPC client
5. Add handle reception in child agent
6. Add `supportHandles` option validation
7. Add platform checks (warn on Windows)
8. Write integration tests for handle passing
9. Test handle ownership transfer

**Dependencies**: Phase 2 (needs types)

**Validation**:
- Socket can be sent from parent and received in child
- Server can accept connections after transfer
- Parent cannot use handle after transfer
- Platform warnings work correctly

### Phase 4: Documentation and Examples (Priority: High, Duration: 2-3 days)

**Goal**: Provide comprehensive documentation and examples

**Steps**:
1. Add "Serialization Modes" section to README
2. Create examples/advanced-serialization/ directory
3. Write Buffer processing example
4. Write BigInt calculations example
5. Write Map/Set collections example
6. Write socket transfer example
7. Write error preservation example
8. Add migration guide
9. Create performance benchmarks
10. Update API documentation
11. Add troubleshooting section

**Dependencies**: Can run parallel with Phase 3

**Validation**:
- All examples run successfully
- Documentation is clear and comprehensive
- Benchmarks show realistic performance data
- Migration guide is actionable

## Key Design Decisions

### 1. Type System Approach
**Decision**: Use conditional types with Mode parameter
**Rationale**: Provides compile-time safety without runtime overhead
**Alternative Considered**: Runtime validation only (rejected for poor DX)

### 2. Handle Passing API
**Decision**: Explicit `$sendHandle()` method
**Rationale**: Makes handle transfer obvious and prevents accidents
**Alternative Considered**: Implicit detection (rejected for clarity)

### 3. Default Serialization Mode
**Decision**: 'json' remains default
**Rationale**: Backward compatibility and better performance for simple cases
**Alternative Considered**: 'advanced' as default (rejected for breaking changes)

### 4. Platform Support
**Decision**: Full support on Unix, limited on Windows
**Rationale**: Node.js platform limitations for handle passing
**Mitigation**: Clear warnings and documentation

## Testing Strategy

### Unit Tests
- Type predicate functions (IsProcxiable)
- Mode-aware filtering logic
- Platform detection

### Integration Tests
- Handle passing (socket, server)
- All V8-serializable types
- Mode switching
- Error handling

### Type Tests
- Correct type inference for modes
- Type errors for incompatible types
- Function overload resolution

### Performance Tests
- JSON vs Advanced benchmarks
- Handle passing overhead
- Memory usage

## Migration Strategy

### For Existing Users
1. No changes required (default is 'json')
2. Opt-in to advanced mode per worker
3. Gradual migration based on needs

### For New Users
1. Start with JSON mode for simple data
2. Use advanced mode when needed
3. Follow examples for common patterns

## Risks and Mitigations

### Risk 1: Type System Complexity
**Impact**: Hard to understand/maintain
**Mitigation**: Extensive documentation, clear examples, comments

### Risk 2: Windows Limitations
**Impact**: Handle passing doesn't work
**Mitigation**: Clear platform warnings, documentation

### Risk 3: Performance Regression
**Impact**: Advanced mode slower than JSON
**Mitigation**: Benchmarks, recommendations in docs

### Risk 4: Breaking Changes
**Impact**: Existing code breaks
**Mitigation**: Maintain backward compatibility, default to 'json'

## Success Metrics

- ✅ All type tests pass
- ✅ All integration tests pass
- ✅ Documentation complete and reviewed
- ✅ Examples run successfully
- ✅ No regressions in existing functionality
- ✅ Positive feedback on API design

## References

- [Enhancement Specification](../ENHANCEMENT_SPEC_ADVANCED_SERIALIZATION.md)
- [Phase 1 Implementation](https://github.com/pradeepmouli/procxy/pull/12)
- [Node.js Child Process Documentation](https://nodejs.org/api/child_process.html)
- [TypeScript Handbook - Conditional Types](https://www.typescriptlang.org/docs/handbook/2/conditional-types.html)
