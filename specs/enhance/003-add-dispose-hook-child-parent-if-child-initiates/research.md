# Research

## Decisions

- Decision: Add a typed `dispose` child-to-parent message that triggers parent-side termination immediately.
  - Rationale: Keeps lifecycle symmetric and avoids child-side manual process exit without cleanup.
  - Alternatives considered: Child exits directly (would skip parent cleanup); add new RPC-style command (unneeded complexity for one-way signal).

- Decision: Keep dispose handling idempotent; multiple dispose signals or repeated calls should not throw and should short-circuit if already terminating/terminated.
  - Rationale: Prevents race issues when dispose is called during concurrent work or retry loops.
  - Alternatives considered: Single-fire only (risks unhandled signals if state races), error on repeat (harder for callers to reason about).

- Decision: Extend existing message typing (ChildToParentMessage union) and handle via the parent IPC client event loop, reusing current termination path.
  - Rationale: Centralizes lifecycle handling; avoids ad-hoc listeners per instance.
  - Alternatives considered: Separate event emitter channel (extra plumbing, redundant transport).

- Decision: Emit the standard `terminated` lifecycle event after parent-initiated termination path runs in response to child dispose; optionally mark termination reason internally as "child-dispose" if needed for logging only (no API change now).
  - Rationale: Preserves existing external contract while enabling observability.
  - Alternatives considered: New public event (would expand API surface without clear requirement).

- Decision: Testing coverage via unit tests for child dispose message dispatch and parent handler branching; integration test for end-to-end child-initiated dispose flow.
  - Rationale: Ensures both serialization contract and runtime behavior are validated.
  - Alternatives considered: Integration-only (would miss contract typing regressions); unit-only (would miss runtime sequencing).
