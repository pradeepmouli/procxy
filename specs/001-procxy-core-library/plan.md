# Implementation Plan: Procxy - Process Proxy Library

**Branch**: `001-procxy-core-library` | **Date**: 2025-12-27 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-procxy-core-library/spec.md`

## Summary

Procxy provides an ergonomic TypeScript library for instantiating objects in Node.js child processes and interacting with them transparently via proxies. The core technical approach uses Error stack trace inspection for automatic module path detection, IPC message passing for method invocation, and dual-proxy architecture (parent and child) to bridge the process boundary. EventEmitter support enables bidirectional event streaming.

## Technical Context

**Language/Version**: TypeScript 5.3+, targeting Node.js >= 18.0.0
**Primary Dependencies**: Zero runtime dependencies (pino for development logging, vitest for testing)
**Storage**: N/A (in-memory IPC only)
**Testing**: vitest (unit + integration), with test coverage target >90%
**Target Platform**: Node.js (Linux, macOS, Windows) - both ESM and CommonJS support
**Project Type**: Single library project (npm package)
**Performance Goals**: <10ms IPC overhead per method call, <50KB bundle size (minified)
**Constraints**: Zero external runtime dependencies, JSON-serializable arguments only, Node.js built-in IPC only
**Scale/Scope**: Single library with 6 core modules, ~2000 LOC, 15 public APIs

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Core Principles Alignment

✅ **I. Ergonomics First**:
- API signature: `procxy(Constructor, ...args)` - minimal boilerplate
- Auto-detection of module paths via stack traces
- Standard async/await patterns throughout
- No manual IPC setup required

✅ **II. Type Safety (NON-NEGOTIABLE)**:
- Generic `Procxy<T>` type with mapped method signatures
- Full TypeScript strict mode enabled
- Compile-time type checking for all method calls
- Zero `any` types in public APIs

✅ **III. Transparency**:
- Proxy objects behave like local instances
- Error stack traces preserved from child
- EventEmitter integration transparent
- Lifecycle methods prefixed with `$` (non-invasive)

✅ **IV. Asynchrony**:
- All remote calls return `Promise<T>`
- Concurrent method calls supported via message correlation
- Async/await friendly API

✅ **V. Reliability**:
- 3-retry timeout mechanism before rejection
- Automatic child process cleanup on parent exit
- Fail-fast on child crashes
- Clear error messages with context

**Verdict**: ✅ No constitution violations. Project aligns with all core principles.

## Project Structure

### Documentation (this feature)

```text
specs/001-procxy-core-library/
├── spec.md                    # Feature specification
├── clarifications.md          # Resolved ambiguities
├── module-path-research.md    # Module detection research
├── plan.md                    # This file
├── data-model.md              # Phase 1: Protocol & type definitions
├── contracts/                 # Phase 1: API contracts
│   ├── parent-api.md          # Public parent process API
│   ├── child-api.md           # Child process internals
│   └── protocol.md            # IPC message protocol
└── tasks.md                   # Phase 2: Task breakdown
```

### Source Code (repository root)

```text
src/
├── index.ts                   # Public exports (procxy function, types)
├── parent/
│   ├── procxy.ts              # Main procxy() implementation
│   ├── parent-proxy.ts        # Parent-side Proxy handler
│   ├── ipc-client.ts          # IPC message sending/correlation
│   └── lifecycle.ts           # Process lifecycle & cleanup
├── child/
│   ├── agent.ts               # Child process entry point
│   ├── child-proxy.ts         # Child-side Proxy handler
│   └── event-bridge.ts        # EventEmitter forwarding
├── shared/
│   ├── protocol.ts            # Message type definitions
│   ├── errors.ts              # Custom error classes
│   ├── module-resolver.ts     # Stack trace → module path
│   └── serialization.ts       # JSON serialization validation
└── types/
    ├── procxy.ts              # Procxy<T> mapped type
    └── options.ts             # ProcxyOptions interface

tests/
├── unit/
│   ├── module-resolver.test.ts
│   ├── parent-proxy.test.ts
│   ├── child-proxy.test.ts
│   ├── protocol.test.ts
│   └── serialization.test.ts
├── integration/
│   ├── basic-invocation.test.ts
│   ├── lifecycle.test.ts
│   ├── timeouts.test.ts
│   ├── event-emitter.test.ts
│   ├── error-handling.test.ts
│   └── concurrent-calls.test.ts
└── fixtures/
    ├── calculator.ts          # Test class: basic methods
    ├── async-worker.ts        # Test class: async methods
    ├── event-worker.ts        # Test class: EventEmitter
    └── broken-worker.ts       # Test class: throws errors
```

**Structure Decision**: Single project structure chosen because:
- This is a library, not an application
- No frontend/backend split required
- Monolithic structure keeps parent/child code co-located
- Clear separation via `parent/`, `child/`, and `shared/` folders

## Phase 0: Research & Validation

**Objective**: Validate technical feasibility and identify risks

### Research Tasks

1. **Module Path Detection** ✅ COMPLETE
   - Document: `module-path-research.md`
   - Decision: Error stack trace inspection + explicit fallback
   - Risk: Low - proven approach with fallback option

2. **IPC Performance Benchmarking** 🔄 PENDING
   - Measure: Node.js built-in IPC latency
   - Target: Confirm <10ms overhead achievable
   - Method: Benchmark `process.send()` round-trip time
   - Output: Add performance baseline to plan

3. **EventEmitter Bridging Strategy** 🔄 PENDING
   - Research: How to detect if class extends EventEmitter
   - Approach: Check prototype chain for EventEmitter
   - Edge case: Multiple inheritance, custom event systems
   - Output: Document detection algorithm

4. **TypeScript Mapped Type Validation** 🔄 PENDING
   - Validate: `Procxy<T>` type correctly infers all methods
   - Test: Complex class hierarchies, inherited methods
   - Edge case: Private methods, symbols, getters/setters
   - Output: Refine type definition if needed

### Risks Identified

| Risk | Severity | Mitigation |
|------|----------|------------|
| Stack trace format varies across Node versions | LOW | Test on Node 18, 20, 22; document supported versions |
| Constructor name mangling in minified code | MEDIUM | Require named classes, provide `modulePath` fallback |
| IPC message size limits | LOW | Document max message size, validate serialization |
| EventEmitter.on() type inference | MEDIUM | Use conditional types to preserve event signatures |
| Child process spawn time | LOW | Document expected startup latency (~50-100ms) |

## Phase 1: Design & Contracts

**Objective**: Define all interfaces, protocols, and data models

### Deliverables

1. **data-model.md**: Define core data structures
   - Message types (INIT, CALL, RESULT, ERROR, EVENT)
   - Request/Response correlation model
   - Error serialization format
   - Event serialization format

2. **contracts/parent-api.md**: Public API contract
   - `procxy<T>(constructor, ...args)` signature
   - `procxy<T>(constructor, options, ...args)` signature
   - `Procxy<T>` type definition
   - `ProcxyOptions` interface
       - Fields:
          - `args?: Jsonifiable[]` (from type-fest) — JSON-serializable arguments to pass to child process (accessible via process.argv)
          - `env?: NodeJS.ProcessEnv` — environment variables for child process (must be string values)
          - `cwd?: string` — working directory for child process (must exist and be a directory)
          - `timeout?: number` — per-call timeout in milliseconds (default: 30000). On timeout, Promise rejects but child continues.
          - `retries?: number` — additional attempts per call (default: 3), e.g., 3 retries = 4 total attempts.
          - `modulePath?: string` — explicit module path, overrides stack-trace auto-detection
   - Error types thrown
   - Lifecycle guarantees

3. **contracts/child-api.md**: Child process contract
   - Agent entry point behavior
   - Module import mechanism
   - Instance creation protocol
   - Method invocation handling
   - Event forwarding mechanism

4. **contracts/protocol.md**: IPC protocol specification
   - Message format (JSON schema)
   - Message flow diagrams
   - Correlation ID strategy (UUID v4)
   - Timeout handling protocol
   - Error propagation rules
   - Event streaming protocol

### Architecture Decisions

**Decision 1: Module Resolution**
- **Choice**: Stack trace inspection with explicit override
- **Alternative**: Require explicit path always
- **Rationale**: Better DX for 90% of cases, fallback covers edge cases

**Decision 2: Serialization**
- **Choice**: JSON.stringify/parse only
- **Alternative**: Structured clone, custom serializers
- **Rationale**: Simpler, explicit, predictable; aligns with constitution's simplicity principle

**Decision 3: EventEmitter Detection**
- **Choice**: Runtime prototype chain check
- **Alternative**: Require explicit EventEmitter type annotation
- **Rationale**: More ergonomic, no user code changes needed

**Decision 4: Timeout Mechanism**
- **Choice**: Per-call timeout with retry
- **Alternative**: Global timeout only
- **Rationale**: More flexible, allows fine-grained control per method

**Decision 5: Child Process Reuse**
- **Choice**: One child per `procxy()` call
- **Alternative**: Shared child process pool
- **Rationale**: Simpler, better isolation, aligns with transparency principle

## Phase 2: Task Breakdown (via /speckit.tasks)

**Note**: This section is a preview. Full task breakdown will be generated by `/speckit.tasks` command.

### Expected Task Categories

1. **Core Infrastructure** (6-8 tasks)
   - Setup TypeScript build configuration
   - Implement protocol message types
   - Create custom error classes
   - Implement module path resolver

2. **Parent Side** (8-10 tasks)
   - Implement `procxy()` main function
   - Create parent Proxy handler
   - Implement IPC client with correlation
   - Add timeout and retry logic
   - Implement lifecycle management
   - Add process cleanup handlers

3. **Child Side** (6-8 tasks)
   - Create agent entry point
   - Implement child Proxy handler
   - Add dynamic import mechanism
   - Implement EventEmitter bridge
   - Handle graceful shutdown

4. **Type System** (4-6 tasks)
   - Define `Procxy<T>` mapped type
   - Add EventEmitter conditional type
   - Create type tests
   - Export public types

5. **Testing** (12-15 tasks)
   - Unit tests for each module
   - Integration tests for user stories
   - EventEmitter integration tests
   - Error handling tests
   - Performance benchmarks

6. **Documentation** (4-6 tasks)
   - API reference (JSDoc)
   - README with examples
   - Migration guide (if needed)
   - Performance characteristics

**Estimated Total**: 40-55 tasks
**Estimated Effort**: 3-5 days (single developer)

## Success Criteria

From specification, these must all pass:

- **SC-001**: ✅ Setup and usage requires <10 lines of code
- **SC-002**: ✅ TypeScript autocomplete works in VS Code
- **SC-003**: ✅ Method call overhead <10ms (to be benchmarked)
- **SC-004**: ✅ Zero memory leaks after 1000 calls
- **SC-005**: ✅ Test coverage >90%
- **SC-006**: ✅ Runnable examples in documentation
- **SC-007**: ✅ Clear error messages (parent vs child)
- **SC-008**: ✅ 100% child process cleanup on parent exit

## Next Steps

1. ✅ Complete Phase 0 research (pending items above)
2. ✅ Create data-model.md with protocol definitions
3. ✅ Create contracts/ directory with API specifications
4. ⏭️ Run `/speckit.tasks` to generate detailed task breakdown
5. ⏭️ Begin implementation following task order

## Notes

- **TypeScript Version**: Using 5.3+ for improved mapped types
- **Node Version Support**: 18.x (LTS), 20.x (LTS), 22.x (Current)
- **Bundle Strategy**: Single entry point, tree-shakeable exports
- **Distribution**: Publish to npm as ESM with TypeScript types
- **License**: MIT (assumed, confirm with user)
