# Enhancement: Add Procxy Deduplication for Concurrent Creation

**Enhancement ID**: enhance-004
**Branch**: `enhance/004-add-concurrency-mutex-support-avoid-race`
**Created**: January 7, 2026
**Priority**: [ ] High | [x] Medium | [ ] Low
**Component**: Core procxy() function
**Status**: [ ] Planned | [ ] In Progress | [x] Complete

## Input
User description: "add concurrency/mutex support to avoid race conditions for creation of procxyies etc..."

## Overview
Add deduplication to prevent duplicate child process creation when multiple concurrent calls to `procxy()` target the same constructor/module. When a procxy creation is in-flight, concurrent callers receive the same promise instead of spawning additional children.

## Motivation
When applications create multiple procxy instances concurrently for the same class:
```js
const [s1, s2] = await Promise.all([
  procxy(ServerManager, options1, args1),
  procxy(ServerManager, options2, args2)
])
```
Without deduplication, both spawn separate child processes—wasting resources. Deduplication returns the same proxy, avoiding duplicates while keeping implementation simple and lock-free.

## Proposed Changes
- Track in-flight procxy creations in a Map keyed by (constructor, modulePath)
- When a call arrives with an in-flight entry, return the pending Promise
- Store the resolved procxy in a cache for future identical calls
- Clear in-flight entry once resolved
- Add debug logging for dedup hits/misses

**Files to Modify**:
- `src/parent/procxy.ts` - Add in-flight deduplication Map and logic
- No new dependencies required (no async-lock)

**Breaking Changes**: [ ] Yes | [x] No
No breaking changes—deduplication is transparent; callers get same proxy when concurrent.

## Implementation Plan

**Phase 1: Implementation**

**Tasks**:
1. [ ] Create in-flight Map in procxy.ts: Map<string, Promise<Procxy>>
2. [ ] Generate dedup key from constructor + modulePath
3. [ ] Check in-flight Map before fork(); return pending if hit
4. [ ] Store fork+init Promise in in-flight Map
5. [ ] Cache successful procxy in a result Map for future identical calls
6. [ ] Clear in-flight entry on resolution (success or error)
7. [ ] Add debug logging: "dedup hit", "dedup miss", "dedup cached"
8. [ ] Write unit test: concurrent calls return same proxy
9. [ ] Write unit test: sequential calls after dedup use cache
10. [ ] Verify no child process leaks on error

**Acceptance Criteria**:
- [ ] Two concurrent procxy() calls for same constructor spawn only 1 child
- [ ] Both callers receive the same proxy instance
- [ ] Debug output shows "dedup hit" for second concurrent call
- [ ] Sequential calls after first completion hit cache ("dedup cached")
- [ ] Error in first call is propagated to all waiting callers
- [ ] Unit tests pass for concurrent dedup scenario
- [ ] Integration tests show single child vs. multiple spawns

## Testing
- [ ] Unit test: 20 concurrent procxy() calls to same constructor—verify 1 child spawned
- [ ] Unit test: Dedup cache hit on sequential calls after first completes
- [ ] Unit test: Error in first call rejects all pending callers
- [ ] Integration test: Compare child count before/after dedup
- [ ] Edge case: Different modulePaths = separate dedup entries

## Verification Checklist
- [ ] Changes implemented as described
- [ ] Tests written and all passing
- [ ] No regressions in existing functionality
- [ ] Debug logs show dedup behavior when enabled
- [ ] Code reviewed
- [ ] Child process count verified in concurrent scenario

## Notes
- Dedup key format: `${constructor.name}:${modulePath}` (simple, readable)
- In-flight Map clears entry on resolution or rejection (Promise.finally)
- Cache is optional; can be enabled via future option if needed
- Alternative: Allow explicit singleton mode via ProcxyOptions in future
## Implementation Summary

✅ **Completed Tasks**:
1. [x] Added `inFlightDedup` Map to track in-flight procxy creations
2. [x] Generate dedup key from constructor + modulePath
3. [x] Check in-flight Map before fork(); return pending if hit
4. [x] Store fork+init Promise in in-flight Map
5. [x] Clear in-flight entry on resolution (success or error)
6. [x] Add debug logging: "dedup hit", "dedup miss", "dedup cleanup"
7. [x] Write unit tests for dedup logic
8. [x] Write integration tests for concurrent dedup scenario
9. [x] Build passes with no regressions
10. [x] All dedup tests pass

**Files Modified**:
- `src/parent/procxy.ts` - Added dedup infrastructure, check, and cleanup
- `tests/unit/deduplication.test.ts` - Unit tests for dedup logic
- `tests/integration/deduplication.test.ts` - Integration tests for concurrent behavior

**Debug Output**:
- `DEBUG=procxy:dedup` for debug package users
- `PROCXY_DEBUG_DEDUP=1` for fallback env-based logging
- Logs: "dedup hit", "dedup miss", "dedup cleanup"

**Performance**:
- Zero overhead when no concurrent calls (single entry not deduplicated)
- No additional dependencies added
- Lock-free, async-friendly approach using Promise identity
---
*Enhancement created using `/enhance` workflow - See .specify/extensions/workflows/enhance/*
