---
name: Callback Proxy Support
about: Track implementation of callback/function proxying across process boundaries
title: 'Feature: Add callback proxy support for bi-directional communication'
labels: enhancement, feature
assignees: ''
---

## Summary

Enable proxying of function callbacks across process boundaries to support bi-directional communication patterns.

## Motivation

Currently, procxy only supports JSON-serializable parameters and return values. This excludes:
- EventEmitter events with function parameters
- Method parameters that are callbacks
- Bi-directional communication patterns common in RPC frameworks

Example that doesn't work today:

```typescript
class Worker extends EventEmitter<{
  progress: [callback: (percent: number) => void];  // ✗ Function not allowed
}> {
  async process(onUpdate: (status: string) => void) {  // ✗ Callback param not allowed
    onUpdate('Starting...');
    // ... work ...
    onUpdate('Complete!');
  }
}
```

## Proposed Solution

Implement a callback registry system:

### Architecture

1. **Callback Registry**: Maintain `Map<callbackId, Function>` in both processes
2. **Serialization**: Replace functions with `{ __procxy_callback: 'uuid' }` during serialization  
3. **Deserialization**: Replace callback placeholders with proxy functions that send IPC messages
4. **Invocation**: Proxy function sends IPC message with callback ID and arguments
5. **Execution**: Parent looks up real function, invokes it, sends result back if async
6. **Cleanup**: Remove callbacks from registry on proxy termination

### Implementation Steps

- [ ] Design callback serialization format
- [ ] Implement callback registry in parent process
- [ ] Implement callback registry in child process  
- [ ] Add callback detection to serialization logic
- [ ] Create callback proxy functions
- [ ] Handle callback invocation over IPC
- [ ] Implement callback cleanup on termination
- [ ] Update type system to allow function parameters
- [ ] Add comprehensive tests
- [ ] Update documentation with examples

### Type System Changes

Relax `IsJsonifiable` to recognize callback patterns:

```typescript
// Current: Functions filtered out
type IsJsonifiable<T> = T extends Function ? false : ...

// Proposed: Allow callback functions
type IsJsonifiable<T> = 
  T extends (...args: any[]) => any ? true :  // Allow callbacks
  T extends Function ? false :  // Still filter out classes
  ...
```

Update `JsonifiableEventMap` to support callback events.

## Benefits

- ✅ Richer API surface - support callbacks as parameters
- ✅ More EventEmitter events - no longer filter out callback-based events
- ✅ Bi-directional patterns - child can invoke parent code
- ✅ Common RPC patterns - progress callbacks, streaming, etc.

## Considerations

### Performance
- Callback invocations add IPC round-trip latency
- Consider batching for high-frequency callbacks

### Memory Management  
- Risk of memory leaks if callbacks not cleaned up
- Need robust cleanup on proxy termination
- Consider weak references where appropriate

### Error Handling
- Handle cases where callback is invoked after proxy termination
- Propagate errors from callback invocations

### Opt-in vs Default
- Consider making this opt-in via options flag
- Conservative default maintains current behavior
- Users opt into additional complexity when needed

## Related Work

Similar patterns in existing libraries:
- Electron's IPC callback support
- WorkerRPC callback proxying
- JSON-RPC with callbacks

## Timeline

Target for v2.0.0 release or as experimental feature in v1.x

## Questions

1. Should callback support be opt-in or default?
2. How to handle callback return values (sync vs async)?
3. Timeout behavior for callback invocations?
4. Maximum callback registry size limits?
