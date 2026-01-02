# Tasks: Add Dispose Hook from Child to Parent

**Input**: Design documents from `/specs/enhance/003-add-dispose-hook-child-parent-if-child-initiates/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

**Tests**: Requested in spec (unit + integration)
**Organization**: Tasks grouped by user story for independent implementation/testing.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Ensure branch and docs are ready for implementation

- [x] T001 Confirm working on branch enhance/003-add-dispose-hook-child-parent-if-child-initiates in repo root

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Align contracts and documentation before coding

- [x] T002 [P] Sync dispose contract details in specs/enhance/003-add-dispose-hook-child-parent-if-child-initiates/contracts/ipc-messages.md

**Checkpoint**: Foundation ready - user story implementation can begin

---

## Phase 3: User Story 1 - Child-initiated dispose (Priority: P1) 🎯 MVP

**Goal**: Parent auto-terminates when child sends a dispose signal; lifecycle events remain consistent.
**Independent Test**: Trigger child dispose and observe parent receives dispose message, terminates child, and emits terminated event without errors.

### Tests for User Story 1

- [x] T003 [P] [US1] Add unit test for child dispose() sending `{ type: 'DISPOSE' }` in tests/unit/child-proxy.test.ts
- [x] T003a [P] [US1] Add unit test verifying dispose() idempotency (multiple calls safe) in tests/unit/child-proxy.test.ts
- [x] T004 [P] [US1] Add integration test for end-to-end child-initiated dispose flow in tests/integration/child-dispose.test.ts
- [x] T004a [P] [US1] Add integration test for dispose during in-flight RPC (verify RPC rejects with ChildCrashedError) in tests/integration/child-dispose.test.ts

### Implementation for User Story 1

- [x] T005 [US1] Extend ChildToParentMessage union with dispose variant in src/shared/protocol.ts
- [x] T006 [US1] Implement child proxy dispose() to emit dispose message in src/child/child-proxy.ts
- [x] T007 [US1] Handle dispose in parent IPC client message handler; add case for type='DISPOSE' that calls this.terminate() in src/parent/ipc-client.ts
- [x] T008 [US1] Ensure procxy emits terminated on child-initiated dispose and keeps termination idempotent (verified existing implementation)
- [x] T009 [P] [US1] Update docs for child-initiated dispose flow in specs/enhance/003-add-dispose-hook-child-parent-if-child-initiates/quickstart.md

**Checkpoint**: User Story 1 independently testable (dispose signal → parent termination → terminated event)

---

## Final Phase: Polish & Cross-Cutting Concerns

- [x] T010 Run full test suite from repo root (`pnpm test`) to verify regression-free

---

## Dependencies & Execution Order

### Phase Dependencies
- Setup (Phase 1) → Foundational (Phase 2) → User Story 1 (Phase 3) → Polish (Final)

### User Story Dependencies
- User Story 1 (P1) depends on Foundational completion; no other stories.

### Within User Story 1
- Tests T003/T003a/T004/T004a should be authored before implementation tasks T005-T008.
- Implement serialization (T005) → child send (T006) → parent handle (T007) → procxy events/idempotency (T008) → docs (T009).

### Parallel Opportunities
- T003/T003a and T004/T004a can run in parallel (test tasks in same files, independent test cases).
- T005/T006/T007 touch different files and can be parallelized cautiously; sequence preferred to align contract.
- T009 can proceed in parallel after contract agreed.

---

## Parallel Execution Example (User Story 1)

```bash
# In parallel
# Terminal 1: add unit test
# Terminal 2: add integration test
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)
1) Complete Setup + Foundational
2) Write failing tests (T003, T004)
3) Implement T005 → T006 → T007 → T008
4) Update docs (T009)
5) Run full suite (T010)

### Incremental Delivery
- After T005-T008, validate integration via T004 before docs and full suite.
