# Tasks: Procxy - Process Proxy Library

**Input**: Design documents from `/specs/001-procxy-core-library/`
**Prerequisites**: plan.md, spec.md, clarifications.md, module-path-research.md

**Tests**: Tests are NOT explicitly requested in the specification, but vitest unit and integration tests are included in the plan with >90% coverage target. Tests will be included as separate tasks.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4, US5, US6)
- Include exact file paths in descriptions

## Path Conventions

- Single library project: `src/`, `tests/` at repository root
- Paths assume TypeScript project structure per plan.md

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [ ] T001 Create project directory structure: src/, src/parent/, src/child/, src/shared/, src/types/, tests/, tests/unit/, tests/integration/, tests/fixtures/
- [ ] T002 Initialize TypeScript configuration in tsconfig.json with strict mode, ES2022 target, and Node18+ lib
- [ ] T003 [P] Configure package.json with type: "module", exports for ESM, TypeScript and vitest dependencies
- [ ] T004 [P] Configure vitest in vitest.config.ts with coverage target >90%
- [ ] T005 [P] Add development dependencies: pino for logging, @types/node, tsx for script execution

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T006 [P] Define IPC protocol message types in src/shared/protocol.ts (InitMessage, Request, Response, EventMessage)
- [ ] T007 [P] Implement custom error classes in src/shared/errors.ts (ProcxyError, TimeoutError, ModuleResolutionError, ChildCrashedError)
- [ ] T008 [P] Implement module path resolver in src/shared/module-resolver.ts using Error stack trace inspection per research findings; fallback order: (1) stack trace detection, (2) use `options.modulePath` override if provided, (3) throw ModuleResolutionError with clear guidance
- [ ] T009 [P] Implement JSON serialization validation utilities in src/shared/serialization.ts
- [ ] T010 Define Procxy<T> mapped type in src/types/procxy.ts that converts all methods to Promise-returning
- [ ] T011 Define ProcxyOptions interface in src/types/options.ts with timeout, retries, modulePath, env, cwd, args fields
- [ ] T012 Create test fixture classes in tests/fixtures/: calculator.ts (basic synchronous methods), async-worker.ts (async methods), event-worker.ts (EventEmitter-based), broken-worker.ts (throws errors)

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Basic Remote Method Invocation (Priority: P1) 🎯 MVP

**Goal**: Enable developers to call methods on remote objects transparently using async/await, with proper error propagation

**Independent Test**: Create a Calculator class with add(a, b) method, instantiate via procxy, call add(2, 3), verify result is 5. Test async methods and error propagation independently.

### Tests for User Story 1

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

Dependency note: T012 (fixtures) must be created before T013–T017 so tests can import the fixture classes.

- [ ] T013 [P] [US1] Write unit test for parent Proxy handler in tests/unit/parent-proxy.test.ts
- [ ] T014 [P] [US1] Write unit test for child Proxy handler in tests/unit/child-proxy.test.ts
- [ ] T015 [P] [US1] Write integration test for basic method invocation in tests/integration/basic-invocation.test.ts using calculator fixture
- [ ] T016 [P] [US1] Write integration test for async method handling in tests/integration/basic-invocation.test.ts using async-worker fixture
- [ ] T017 [P] [US1] Write integration test for error propagation in tests/integration/error-handling.test.ts using broken-worker fixture

### Implementation for User Story 1

- [ ] T018 [P] [US1] Implement child agent entry point in src/child/agent.ts that listens for InitMessage, imports module, and instantiates class
- [ ] T019 [P] [US1] Implement child Proxy handler in src/child/child-proxy.ts that receives Request messages and invokes methods on instance
- [ ] T020 [US1] Implement IPC client in src/parent/ipc-client.ts with message correlation using UUID v4 (crypto.randomUUID), request/response mapping, and Promise handling
- [ ] T021 [US1] Implement parent Proxy handler in src/parent/parent-proxy.ts that intercepts method calls, validates method names are valid identifiers (FR-014), and sends Request messages via IPC client
- [ ] T022 [US1] Implement main procxy() function in src/parent/procxy.ts that validates constructor arguments are JSON-serializable (FR-019, FR-022), resolves module path, spawns child with agent, sends InitMessage, returns parent Proxy
- [ ] T023 [US1] Update src/index.ts to export procxy function and Procxy<T>, ProcxyOptions types
- [ ] T024 [US1] Verify all US1 tests pass and error messages include stack traces from child
   - Include explicit concurrency verification: multiple simultaneous calls resolve with correct correlation IDs and without cross-talk (FR-006)

**Checkpoint**: At this point, User Story 1 should be fully functional - basic method calls, async methods, and error propagation all work

---

## Phase 4: User Story 4 - Type-Safe Method Calls (Priority: P1)

**Goal**: Ensure TypeScript provides full type safety with autocomplete, argument type checking, and return type inference

Note: US4 can proceed in parallel with US1 once Foundational (Phase 2) is complete.

**Independent Test**: This is validated at compile time. Create a Service class with typed methods, verify TypeScript catches wrong argument types and provides autocomplete.

### Tests for User Story 4

- [ ] T025 [P] [US4] Create TypeScript type tests in tests/unit/types.test.ts that verify Procxy<T> correctly maps method signatures
- [ ] T026 [P] [US4] Add type tests for method argument type checking (should fail compilation with wrong types)
- [ ] T027 [P] [US4] Add type tests for return type inference (verify async Promise<T> return types)

### Implementation for User Story 4

- [ ] T028 [US4] Refine Procxy<T> mapped type in src/types/procxy.ts to handle complex class hierarchies and inherited methods
- [ ] T029 [US4] Add TypeDoc comments to all public APIs in src/index.ts for better IDE experience
- [ ] T030 [US4] Verify TypeScript compiler catches type errors in test files

**Checkpoint**: At this point, type safety should be fully functional - IDE autocomplete works, type errors are caught at compile time

---

## Phase 5: User Story 2 - Lifecycle Management (Priority: P2)

**Goal**: Allow developers to control child process lifecycle with explicit termination and automatic cleanup on parent exit

**Independent Test**: Create a proxy, verify child process is running, call $terminate(), confirm process exits. Test automatic cleanup on parent SIGTERM.

### Tests for User Story 2

- [ ] T031 [P] [US2] Write integration test for $terminate() in tests/integration/lifecycle.test.ts
- [ ] T032 [P] [US2] Write integration test for automatic cleanup on parent exit in tests/integration/lifecycle.test.ts
- [ ] T033 [P] [US2] Write integration test for handling child process crashes in tests/integration/lifecycle.test.ts

### Implementation for User Story 2

- [ ] T034 [P] [US2] Implement lifecycle management in src/parent/lifecycle.ts with process tracking registry
- [ ] T035 [US2] Add $terminate() method to parent Proxy in src/parent/parent-proxy.ts that kills child and rejects pending promises
- [ ] T036 [US2] Add $process property to parent Proxy in src/parent/parent-proxy.ts that exposes ChildProcess instance
- [ ] T037 [US2] Add automatic cleanup handlers in src/parent/lifecycle.ts for SIGTERM, SIGINT, and beforeExit events
- [ ] T038 [US2] Add child crash detection in src/parent/ipc-client.ts that rejects pending promises with ChildCrashedError
- [ ] T039 [US2] Verify all US2 tests pass and processes are cleaned up 100% of the time

#### Cleanup tasks (Memory and listeners)

- [ ] T083 [US2] Ensure IPC client cleans up request/response maps after RESULT/ERROR to prevent memory growth (NFR-002)
- [ ] T084 [US2] Ensure `$terminate()` removes all event listeners on parent proxy and detaches child IPC handlers
- [ ] T085 [US2] Ensure automatic cleanup on child exit removes parent-side listeners and rejects any remaining promises

**Checkpoint**: At this point, lifecycle management should be fully functional - explicit termination works, automatic cleanup works, crash detection works

---

## Phase 6: User Story 6 - EventEmitter Integration (Priority: P2)

**Goal**: Enable transparent event forwarding from child to parent for classes extending EventEmitter

**Independent Test**: Create a class extending EventEmitter, emit events from child, verify listeners in parent receive them with correct data.

### Tests for User Story 6

- [ ] T040 [P] [US6] Write unit test for EventEmitter detection in tests/unit/event-bridge.test.ts
- [ ] T041 [P] [US6] Write integration test for event forwarding in tests/integration/event-emitter.test.ts using event-worker fixture
- [ ] T042 [P] [US6] Write integration test for multiple event listeners in tests/integration/event-emitter.test.ts

### Implementation for User Story 6

- [ ] T043 [P] [US6] Implement EventEmitter detection via prototype chain check in src/shared/module-resolver.ts
- [ ] T044 [US6] Implement event bridge in src/child/event-bridge.ts that forwards events from child instance to parent via EventMessage
- [ ] T045 [US6] Extend child Proxy in src/child/child-proxy.ts to setup event forwarding on initialization for EventEmitter instances
- [ ] T046 [US6] Extend parent Proxy in src/parent/parent-proxy.ts to handle EventMessage and emit on parent-side proxy
- [ ] T047 [US6] Update Procxy<T> type in src/types/procxy.ts to conditionally preserve EventEmitter interface using conditional types
- [ ] T048 [US6] Verify all US6 tests pass and events are received with correct data and timing

**Checkpoint**: At this point, EventEmitter integration should be fully functional - events flow transparently from child to parent

---

## Phase 7: User Story 3 - Configurable Timeouts (Priority: P3)

**Goal**: Allow developers to configure timeouts per instance to prevent hanging on stuck processes

**Independent Test**: Create a method that sleeps, set a short timeout, verify promise rejects with TimeoutError after timeout expires.

### Tests for User Story 3

- [ ] T049 [P] [US3] Write integration test for timeout behavior in tests/integration/timeouts.test.ts with short timeout and slow method
- [ ] T050 [P] [US3] Write integration test for retry mechanism in tests/integration/timeouts.test.ts
- [ ] T051 [P] [US3] Write integration test for successful calls within timeout in tests/integration/timeouts.test.ts

### Implementation for User Story 3

- [ ] T052 [US3] Implement timeout mechanism in src/parent/ipc-client.ts with configurable duration and retry logic
- [ ] T053 [US3] Add timeout option to ProcxyOptions in src/types/options.ts with default value 30000ms
- [ ] T054 [US3] Add retries option to ProcxyOptions in src/types/options.ts with default value 3
- [ ] T055 [US3] Update procxy() function in src/parent/procxy.ts to pass timeout and retries to IPC client
- [ ] T056 [US3] Verify all US3 tests pass and timeouts work correctly with retries

**Checkpoint**: At this point, timeout configuration should be fully functional - timeouts prevent hanging, retries work as expected

---

## Phase 8: User Story 5 - Custom Child Process Options (Priority: P3)

**Goal**: Allow developers to configure child process environment, working directory, and command line arguments

**Independent Test**: Spawn child with custom env vars, verify they are accessible in child. Test custom cwd and args.

### Tests for User Story 5

- [ ] T057 [P] [US5] Write integration test for custom environment variables in tests/integration/process-options.test.ts
- [ ] T058 [P] [US5] Write integration test for custom working directory in tests/integration/process-options.test.ts
- [ ] T059 [P] [US5] Write integration test for custom command line arguments in tests/integration/process-options.test.ts

### Implementation for User Story 5

- [ ] T060 [US5] Add env, cwd, and args options to ProcxyOptions in src/types/options.ts
- [ ] T061 [US5] Update procxy() function in src/parent/procxy.ts to pass env, cwd, and args to child_process.fork()
- [ ] T062 [US5] Add validation for process options in src/parent/procxy.ts to ensure valid values
- [ ] T063 [US5] Verify all US5 tests pass and child process receives correct options

**Checkpoint**: At this point, custom process options should be fully functional - env, cwd, and args are configurable

---

## Phase 9: Additional Testing & Edge Cases

**Purpose**: Comprehensive test coverage for edge cases and concurrent scenarios

- [ ] T064 [P] Write unit tests for module resolver in tests/unit/module-resolver.test.ts with various stack trace formats
- [ ] T065 [P] Write unit tests for protocol message types in tests/unit/protocol.test.ts
- [ ] T066 [P] Write unit tests for serialization validation in tests/unit/serialization.test.ts
- [ ] T067 [P] Write integration test for concurrent method calls in tests/integration/concurrent-calls.test.ts
- [ ] T068 [P] Write integration test for explicit modulePath override in tests/integration/module-resolution.test.ts
- [ ] T069 [P] Write integration test for constructor arguments in tests/integration/constructor-args.test.ts
- [ ] T070 [P] Write performance benchmarks in tests/integration/performance.test.ts to verify <10ms overhead goal

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, optimization, and final validation

- [ ] T071 [P] Add comprehensive JSDoc comments to all public APIs in src/index.ts, src/types/procxy.ts, src/types/options.ts
- [ ] T072 [P] Create README.md with installation, usage examples, API reference, and troubleshooting guide
- [ ] T073 [P] Create CONTRIBUTING.md with development setup, testing, and contribution guidelines
- [ ] T074 [P] Add example files in examples/ directory: basic-usage.ts, event-emitter.ts, error-handling.ts, lifecycle.ts
- [ ] T075 [P] Generate TypeDoc documentation in docs/ directory
- [ ] T076 Verify all success criteria from spec.md are met (SC-001 through SC-008)
- [ ] T077 Run full test suite with coverage report and verify >90% coverage
- [ ] T078 [P] Performance profiling to confirm <10ms overhead per method call (NFR-001)
- [ ] T079 [P] Memory leak testing with 1000 sequential calls (NFR-004, SC-004)
- [ ] T080 [P] Test bundle size is <50KB minified (NFR-005)
- [ ] T081 Create CHANGELOG.md documenting v1.0.0 features
- [ ] T082 Prepare package.json for npm publishing with correct metadata, keywords, and license

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phases 3-8)**: All depend on Foundational phase completion
  - **User Story 1 (P1)**: Can start after Phase 2 - Core functionality
  - **User Story 4 (P1)**: Can start after Phase 2 - Type system
  - **User Story 2 (P2)**: Depends on User Story 1 completion - Builds on core
  - **User Story 6 (P2)**: Depends on User Story 1 completion - Extends core with events
  - **User Story 3 (P3)**: Depends on User Story 1 completion - Adds timeout layer
  - **User Story 5 (P3)**: Can start after User Story 1 - Independent process configuration
- **Additional Testing (Phase 9)**: Can proceed in parallel with user stories once foundational tests exist
- **Polish (Phase 10)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: FOUNDATIONAL - Must complete first, enables all other stories
- **User Story 4 (P1)**: Can develop in parallel with US1 (type system)
- **User Story 2 (P2)**: Extends US1 with lifecycle - requires US1 complete
- **User Story 6 (P2)**: Extends US1 with events - requires US1 complete
- **User Story 3 (P3)**: Adds timeouts to US1 - requires US1 complete
- **User Story 5 (P3)**: Independent process options - requires US1 complete

### Within Each User Story

1. Tests MUST be written and FAIL before implementation
2. Core implementation before extensions
3. Verify tests pass before marking story complete

### Parallel Opportunities

**Within Setup (Phase 1)**:
- All tasks can run in parallel except T001 (directory structure first)

**Within Foundational (Phase 2)**:
- T006, T007, T008, T009 can run in parallel (different files)
- T012 can run in parallel after directories exist
- T010, T011 must wait for protocol types from T006

**User Story 1**:
- Tests T013-T017 can all run in parallel (different files)
- Implementation: T018, T019 can run in parallel, then T020, T021 in parallel, then T022

**User Story 4**:
- All tests T025-T027 can run in parallel

**User Story 2**:
- Tests T031-T033 can run in parallel
- Implementation: T034 and T038 can run in parallel

**User Story 6**:
- Tests T040-T042 can run in parallel
- Implementation: T043, T044 can run in parallel

**User Story 3**:
- Tests T049-T051 can run in parallel

**User Story 5**:
- Tests T057-T059 can run in parallel

**Additional Testing (Phase 9)**:
- All tasks T064-T070 can run in parallel (different test files)

**Polish (Phase 10)**:
- Documentation tasks T071-T075 can run in parallel
- Testing tasks T077-T080 can run in parallel after all implementation complete

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together:
Task T013: "Write unit test for parent Proxy handler in tests/unit/parent-proxy.test.ts"
Task T014: "Write unit test for child Proxy handler in tests/unit/child-proxy.test.ts"
Task T015: "Write integration test for basic method invocation"
Task T016: "Write integration test for async method handling"
Task T017: "Write integration test for error propagation"

# Launch parallel implementation tasks:
Task T018: "Implement child agent entry point in src/child/agent.ts"
Task T019: "Implement child Proxy handler in src/child/child-proxy.ts"
# Then after T018, T019 complete:
Task T020: "Implement IPC client in src/parent/ipc-client.ts"
Task T021: "Implement parent Proxy handler in src/parent/parent-proxy.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 + User Story 4 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1 (Basic remote method invocation)
4. Complete Phase 4: User Story 4 (Type safety)
5. **STOP and VALIDATE**: Test core functionality independently
6. Ready for initial release v0.1.0

**Delivered Value**: Developers can call remote methods with full type safety - core value proposition complete

### Incremental Delivery

1. MVP (US1 + US4) → v0.1.0 - Basic functionality
2. Add US2 (Lifecycle) → v0.2.0 - Production-ready with cleanup
3. Add US6 (EventEmitter) → v0.3.0 - Event support
4. Add US3 (Timeouts) → v0.4.0 - Reliability improvements
5. Add US5 (Process Options) → v0.5.0 - Advanced configuration
6. Polish → v1.0.0 - Full documentation and optimization

Each version adds value incrementally without breaking existing functionality.

### Parallel Team Strategy

With multiple developers:

1. All complete Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (core functionality)
   - Developer B: User Story 4 (type system) - can work in parallel with A
3. After US1 complete:
   - Developer A: User Story 2 (lifecycle)
   - Developer B: User Story 6 (EventEmitter)
   - Developer C: User Story 3 (timeouts)
4. User Story 5 and testing can proceed in parallel

---

## Success Criteria Checklist

This task list is designed to meet all success criteria from spec.md:

- **SC-001** ✅ Setup and usage <10 lines (US1 delivers this)
- **SC-002** ✅ TypeScript autocomplete works (US4 delivers this)
- **SC-003** ✅ Method call overhead <10ms (T078 validates this)
- **SC-004** ✅ Zero memory leaks after 1000 calls (T079 validates this)
- **SC-005** ✅ Test coverage >90% (T077 validates this)
- **SC-006** ✅ Runnable examples in documentation (T074 delivers this)
- **SC-007** ✅ Clear error messages (US1 error handling delivers this)
- **SC-008** ✅ 100% child process cleanup on parent exit (US2 delivers this)

---

## Notes

- Total tasks: 82 (including 28 test tasks)
- Estimated effort: 3-5 days for single developer (per plan.md)
- [P] tasks = different files, no dependencies between them
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing (TDD approach)
- Run test suite after each task or logical group
- Stop at any checkpoint to validate story independently
- Constitution alignment verified in plan.md - no violations
