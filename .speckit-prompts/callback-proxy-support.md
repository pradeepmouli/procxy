# Callback Proxy Support Feature Specification Prompt

Create a detailed specification for implementing callback/function proxying in the procxy library to enable bi-directional communication across process boundaries.

## Feature Overview

Add support for proxying JavaScript functions (callbacks) across the parent-child process boundary, enabling:
- EventEmitter events with function parameters
- Method parameters that are callbacks
- Bi-directional communication patterns (child can invoke parent code)
- Progress callbacks, streaming, and other common RPC patterns

## Current Limitations

Today, procxy only supports JSON-serializable values:
- Functions are filtered out by `validateJsonifiable()`
- EventEmitter events with function params are excluded by `JsonifiableEventMap` type filtering
- No way for child process to invoke parent code

## Proposed Architecture

### Callback Registry System

Implement a dual-registry architecture:

1. **Parent Process Registry**: `Map<callbackId: string, callback: Function>`
   - Stores original callback functions passed from parent to child
   - Cleanup on proxy termination

2. **Child Process Registry**: `Map<callbackId: string, callback: ProxyFunction>`
   - Stores proxy functions that send IPC messages back to parent
   - Receives callback invocations from parent

### Serialization Flow

**Parent → Child (sending callback)**:
```typescript
// Before: callback function
const callback = (value: number) => console.log(value);

// After serialization:
{
  __procxy_callback: 'uuid-1234',
  __procxy_meta: {
    type: 'function',
    arity: 1  // number of parameters
  }
}
```

**Child → Parent (invoking callback)**:
```typescript
// IPC message format
{
  type: 'callback-invoke',
  callbackId: 'uuid-1234',
  args: [42],
  invokeId: 'invoke-5678'  // for async result tracking
}
```

**Parent → Child (callback result)**:
```typescript
// IPC response for async callbacks
{
  type: 'callback-result',
  invokeId: 'invoke-5678',
  result: 'success',
  value: someValue  // or error if failed
}
```

## Implementation Requirements

### Core Components

1. **Callback Serialization** (`src/shared/callback-serialization.ts`)
   - Detect functions during serialization
   - Generate unique callback IDs (UUID v4)
   - Create callback metadata (arity, name)
   - Replace functions with callback descriptors

2. **Parent Callback Manager** (`src/parent/callback-manager.ts`)
   - Registry for storing callbacks
   - Handle callback invocation requests from child
   - Execute callbacks and send results back
   - Cleanup on proxy termination
   - Memory leak prevention

3. **Child Callback Manager** (`src/child/callback-manager.ts`)
   - Registry for proxy functions
   - Create proxy functions that send IPC messages
   - Handle callback results from parent
   - Support async callback return values

4. **IPC Protocol Updates** (`src/shared/protocol.ts`)
   - New message types: `callback-invoke`, `callback-result`, `callback-cleanup`
   - Message routing for callback invocations
   - Error handling for callback failures

5. **Type System Updates** (`src/types/*.ts`)
   - Remove function filtering from `IsJsonifiable`
   - Update `JsonifiableEventMap` to include callback events
   - New type: `Callback<Args, Return>` for typed callbacks
   - Update `Procxy<T>` to reflect new capabilities

### Configuration Options

Add to `ProcxyOptions`:

```typescript
interface ProcxyOptions {
  // ... existing options

  /**
   * Enable callback proxying (default: false for backward compatibility)
   * When enabled, function parameters are proxied across process boundaries
   */
  enableCallbacks?: boolean;

  /**
   * Maximum number of active callbacks (default: 1000)
   * Prevents memory leaks from accumulating callbacks
   */
  maxCallbacks?: number;

  /**
   * Timeout for callback invocations (default: 30000ms)
   * How long to wait for callback execution in parent
   */
  callbackTimeout?: number;
}
```

## Use Cases & Examples

### Example 1: Progress Callbacks

```typescript
class DataProcessor {
  async process(data: string[], onProgress: (percent: number) => void): Promise<void> {
    for (let i = 0; i < data.length; i++) {
      await this.processItem(data[i]);
      onProgress((i + 1) / data.length * 100);
    }
  }

  private async processItem(item: string): Promise<void> {
    // Heavy processing...
  }
}

// Usage with callback proxy
const processor = await procxy(DataProcessor, './processor.js', {
  enableCallbacks: true
});

await processor.process(
  ['item1', 'item2', 'item3'],
  (percent) => console.log(`Progress: ${percent}%`)
);
```

### Example 2: EventEmitter with Callbacks

```typescript
interface WorkerEvents {
  // Previously filtered out - now supported!
  needsInput: [callback: (input: string) => void];
  progress: [percent: number];  // Still works
}

class InteractiveWorker extends EventEmitter<WorkerEvents> {
  async run() {
    this.emit('needsInput', (input) => {
      console.log('Got input:', input);
      return input.toUpperCase();
    });
  }
}

// Usage
const worker = await procxy(InteractiveWorker, './worker.js', {
  enableCallbacks: true
});

worker.on('needsInput', (callback) => {
  const result = callback('hello');
  console.log(result);  // 'HELLO'
});
```

### Example 3: Async Callback Return Values

```typescript
class AsyncWorker {
  async fetchWithAuth(
    url: string,
    getToken: () => Promise<string>
  ): Promise<Response> {
    const token = await getToken();  // Async callback invocation
    return fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  }
}
```

## Success Criteria

### Functional Requirements
- ✅ Functions can be passed as method parameters
- ✅ Functions can be EventEmitter event parameters
- ✅ Callback invocations work synchronously
- ✅ Async callback return values are supported
- ✅ Callbacks are cleaned up on proxy termination
- ✅ Multiple concurrent callbacks work correctly
- ✅ Callback errors propagate properly

### Performance Requirements
- ✅ Callback invocation overhead: <50ms P95
- ✅ No memory leaks after 10,000 callback invocations
- ✅ Registry size limited (configurable max)
- ✅ Cleanup removes all callbacks on termination

### Type Safety Requirements
- ✅ Full TypeScript inference for callback parameters
- ✅ Return type inference for async callbacks
- ✅ Compile-time errors for invalid callback signatures
- ✅ IntelliSense works for callback parameters

### Backward Compatibility
- ✅ Feature is opt-in via `enableCallbacks` option
- ✅ Default behavior unchanged (callbacks filtered)
- ✅ Existing tests pass without modification
- ✅ No breaking changes to public API

## Technical Constraints

1. **Serialization Format**: Use JSON-compatible format for callback descriptors
2. **ID Generation**: Use UUID v4 for callback IDs (collision-free)
3. **Cleanup Strategy**: Automatic cleanup on proxy termination + manual cleanup API
4. **Error Handling**: Graceful degradation if callback invoked after termination
5. **Performance**: Minimize serialization overhead for non-callback params
6. **Memory**: Weak references where possible, hard limits on registry size

## Testing Requirements

### Unit Tests
- Callback detection during serialization
- Callback ID generation (uniqueness)
- Registry operations (add, get, delete, cleanup)
- Proxy function creation
- IPC message handling
- Error propagation

### Integration Tests
- Simple callback invocation (sync)
- Async callback with return value
- Multiple concurrent callbacks
- Callback with multiple parameters
- Callback invoked multiple times
- EventEmitter with callback events
- Cleanup after proxy termination
- Timeout handling
- Max callbacks limit enforcement
- Memory leak testing (10k invocations)

### Edge Cases
- Callback invoked after proxy termination (should throw)
- Callback throws error (error propagates to child)
- Nested callbacks (callback returns another callback)
- Circular references with callbacks
- Very large callback arguments
- Rapid callback invocations (stress test)

## Documentation Requirements

1. **README.md**: Update with callback proxy examples
2. **API Documentation**: Document `enableCallbacks` option
3. **Migration Guide**: How to enable and use callbacks
4. **Examples**: Add callback-based examples to `/examples`
5. **Type Documentation**: JSDoc for callback-related types
6. **Architecture Guide**: Explain callback registry system

## Open Questions

1. **Callback Retention**: Should callbacks be retained after single use or reusable?
2. **Return Value Handling**: Ignore sync return values or send back?
3. **Batching**: Should high-frequency callbacks be batched for performance?
4. **Serialization Format**: Use JSON or MessagePack for better performance?
5. **Registry Limits**: Per-proxy or global callback limit?
6. **Cleanup API**: Expose manual callback cleanup API?

## References

- Issue: https://github.com/pradeepmouli/procxy/issues/7
- Related code:
  - `src/shared/serialization.ts` (TODO comment)
  - `src/types/procxy.ts` (JsonifiableEventMap filtering)
  - `src/shared/protocol.ts` (IPC message types)
  - `src/parent/ipc-client.ts` (parent IPC handling)
  - `src/child/agent.ts` (child IPC handling)

## Implementation Phases

### Phase 1: Core Infrastructure (Week 1)
- Callback serialization/deserialization
- Parent callback manager
- Child callback manager
- IPC protocol updates

### Phase 2: Integration (Week 2)
- Integrate with existing serialization
- Update parent/child IPC handlers
- Configuration options
- Basic cleanup logic

### Phase 3: Type System (Week 3)
- Update type definitions
- Remove callback filtering
- Test type inference
- Documentation updates

### Phase 4: Testing & Polish (Week 4)
- Comprehensive test suite
- Performance testing
- Memory leak testing
- Documentation
- Examples

## Deliverables

1. Implementation code with tests
2. Updated type definitions
3. Documentation updates
4. Example applications
5. Performance benchmarks
6. Migration guide
