# Enhancement: Add Dispose Hook from Child to Parent

**Enhancement ID**: enhance-003
**Branch**: `enhance/003-add-dispose-hook-child-parent-if-child-initiates`
**Created**: 2026-01-01
**Priority**: [x] Medium
**Component**: child/parent communication, lifecycle management
**Status**: [x] Planned

## Input
User description: "add dispose hook from child to parent - if child initiates dispose, parent should be notified and automatically terminate."

## Overview
Add a dispose hook mechanism that allows a child process to initiate disposal and automatically notify the parent process to terminate the child process gracefully. This establishes bidirectional lifecycle management where either side can initiate cleanup.

## Motivation
Currently, the parent process controls the lifecycle of child processes via the `terminate()` method. However, there's no mechanism for a child process to signal that it needs to shut down and have the parent process properly handle that request. This enhancement adds that capability, allowing for more flexible lifecycle management and graceful shutdowns initiated from either side of the IPC boundary.

## Proposed Changes
- Add a new message type `dispose` to the child-to-parent messaging protocol
- Implement a dispose method on the child side that sends the dispose message to the parent
- Add handler in the parent's IPC client to receive dispose messages and automatically call terminate()
- Ensure proper cleanup and event emission when child-initiated disposal occurs

**Files to Modify**:
- `src/shared/serialization.ts` - Add 'dispose' message type to ChildToParentMessage union
- `src/child/child-proxy.ts` - Add dispose() method to send dispose message to parent
- `src/parent/ipc-client.ts` - Add handler for 'dispose' messages to trigger termination
- `src/parent/procxy.ts` - Ensure proper event emission for child-initiated disposal

**Breaking Changes**: [ ] No
This is an additive change that doesn't modify existing APIs.

## Implementation Plan

**Phase 1: Implementation**

**Tasks**:
1. [ ] Add 'dispose' message type to ChildToParentMessage type definition in shared/serialization.ts
2. [ ] Implement dispose() method in child/child-proxy.ts that sends dispose message to parent
3. [ ] Add dispose message handler in parent/ipc-client.ts that calls terminate() on the procxy instance
4. [ ] Ensure proper event emission ('terminated' event) occurs when child-initiated disposal happens
5. [ ] Add unit tests for child dispose() method message sending
6. [ ] Add integration test for full child-to-parent dispose workflow
7. [ ] Update documentation to describe the dispose hook capability

**Acceptance Criteria**:
- [ ] Child process can call dispose() method to initiate shutdown
- [ ] Parent process receives dispose message and automatically terminates the child
- [ ] Proper cleanup occurs (process exits, events emitted, resources freed)
- [ ] 'terminated' event is emitted when child initiates disposal
- [ ] Tests verify the dispose hook works correctly in both success and error scenarios
- [ ] No impact on existing parent-initiated termination flow

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests pass
- [ ] Manual testing complete
- [ ] Edge cases verified (dispose during active call, multiple dispose calls, etc.)

## Verification Checklist
- [ ] Changes implemented as described
- [ ] Tests written and passing
- [ ] No regressions in existing functionality
- [ ] Documentation updated (if needed)
- [ ] Code reviewed (if appropriate)

## Notes
- Consider whether dispose should be idempotent (multiple calls safe)
- Ensure dispose doesn't interfere with in-flight RPC calls
- Consider adding a 'disposing' event before termination for cleanup hooks

---
*Enhancement created using `/enhance` workflow - See .specify/extensions/workflows/enhance/*
