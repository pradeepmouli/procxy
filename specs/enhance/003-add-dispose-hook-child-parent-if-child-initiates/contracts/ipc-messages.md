# IPC Message Contracts

## ChildToParentMessage (addition)

```typescript
export type ChildToParentMessage =
  | { type: 'response'; id: string; result: unknown }
  | { type: 'error'; id: string; error: SerializedError }
  | { type: 'event'; event: 'ready' | 'crashed' | 'terminated'; detail?: unknown }
  | { type: 'dispose' };
```

- The `dispose` variant carries no payload and is idempotent.
- Parent MUST treat `dispose` as a request to terminate the child process via the normal termination path.
- Parent MUST continue emitting existing lifecycle events (including `terminated`) after handling the dispose signal.
- Child MAY send `dispose` at most once, but parent handling is tolerant of repeats.

## Child Dispose API

```typescript
// Child-side API (callable from within child process)
function dispose(): void;
```

- **Synchronous**: Returns immediately after sending message; does not await termination.
- **Idempotent**: Multiple calls are safe; subsequent calls no-op if already disposing/terminated.
- **No return value**: Fire-and-forget signal to parent.

## Lifecycle Handling Contract

1) Child sends `{ type: 'dispose' }` over the established IPC channel.
2) Parent IPC client receives the message and invokes the same termination routine used for parent-initiated termination.
3) Parent ensures cleanup (kill child process, release resources) and emits lifecycle events.
4) Subsequent dispose/terminate signals while terminating/terminated are ignored (no error thrown).

## In-Flight RPC Interaction

- Dispose signal does NOT cancel pending RPC calls.
- Parent termination will cause in-flight calls to reject with ChildCrashedError (existing behavior).
- Dispose handling prioritizes graceful shutdown; parent may allow brief grace period for pending calls if implementation chooses, but not required for v1.
