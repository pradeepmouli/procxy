# Configuration

## ProcxyOptions

Configuration for the `procxy()` function.

Controls child process spawning, IPC serialization, timeouts, retries, environment
isolation, and optional handle-passing support.

Most options have sensible defaults; only `modulePath` is ever strictly required,
and even that is optional when automatic module resolution succeeds. Pass the object
as the second or third argument to `procxy()`:

```typescript
// Inline — TypeScript infers Mode from `serialization`
await procxy(MyClass, './my-class.js', { timeout: 10_000 });

// Named — use `as const` so `serialization` literal is preserved for type narrowing
const opts = { serialization: 'advanced', supportHandles: true } as const;
await procxy(MyClass, './my-class.js', opts);
```