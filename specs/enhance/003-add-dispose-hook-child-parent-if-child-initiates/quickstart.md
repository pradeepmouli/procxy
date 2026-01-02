# Quickstart: Child-Initiated Dispose

## Overview

Child processes can now signal that they need to shut down by calling `dispose()`. The parent will automatically handle termination gracefully.

## How It Works

1. **Child initiates shutdown**: Call `dispose()` on the child proxy when the worker needs to shut down (e.g., fatal condition, maintenance, graceful restart).
2. **Message sent**: The helper sends `{ type: 'DISPOSE' }` to the parent over the IPC channel.
3. **Parent responds**: The parent IPC client receives the message and runs the standard termination routine:
   - Cleans up pending requests
   - Kills the child process
   - Emits lifecycle events ('child_exit')
4. **Idempotent**: Repeated calls during teardown are ignored without error.
5. **Backward compatible**: Existing parent-initiated termination via `$terminate()` remains unchanged.

## Child-Side Usage

In your child process code, you can call `dispose()` to request termination from the parent:

```typescript
import { getChildProxy } from 'procxy/child';

// Inside child process
const childProxy = getChildProxy(); // Get the child proxy instance

// When you need to shut down:
childProxy.dispose(); // Sends DISPOSE signal to parent
```

## Parent-Side Handling

Parents don't need to do anything special. The child-initiated dispose is transparent:

```typescript
import { procxy } from 'procxy';
import { Worker } from './worker.js';

const worker = await procxy(Worker, './worker.ts');

// The parent automatically handles child-initiated dispose signals
// If the worker calls dispose(), the parent will clean up gracefully

// Manual termination still works:
await worker.$terminate();
```

## Edge Cases

- **Multiple dispose calls**: Safe; only the first dispose sends a message, subsequent calls are no-op.
- **In-flight RPC calls**: Dispose triggers immediate termination; in-flight calls will reject with `ChildCrashedError`.
- **Concurrent operations**: Dispose can be called during method invocations; parent handles gracefully.
