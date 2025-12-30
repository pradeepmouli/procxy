# Procxy Examples

This directory contains comprehensive examples demonstrating various features of the Procxy library.

## Running Examples

All examples are TypeScript files that can be run directly using `tsx`:

```bash
# Install tsx if not already installed
pnpm add -D tsx

# Run any example
pnpm tsx examples/basic-usage.ts
pnpm tsx examples/event-emitter.ts
pnpm tsx examples/error-handling.ts
pnpm tsx examples/lifecycle.ts
```

## Examples Overview

### 1. Basic Usage (`basic-usage.ts`)

Demonstrates fundamental Procxy usage:

- Creating a proxy to a class instance
- Calling methods remotely (all methods return Promises)
- Manual cleanup with `$terminate()`
- Automatic cleanup with `await using` disposables
- Basic error handling

**Key Concepts:**
- Method calls become async
- Explicit module path required
- Disposable pattern for automatic cleanup

### 2. EventEmitter Support (`event-emitter.ts`)

Shows how EventEmitter integration works:

- Events emitted in child process forwarded to parent
- Progress tracking with custom events
- Long-running tasks with event updates
- Data streaming with event-based communication

**Key Concepts:**
- Standard EventEmitter API works transparently
- Events flow from child to parent only
- Multiple event listeners supported

### 3. Error Handling (`error-handling.ts`)

Comprehensive error handling patterns:

- Error propagation from child to parent
- Stack trace preservation
- Timeout errors (`TimeoutError`)
- Child crash handling (`ChildCrashedError`)
- Retry logic implementation
- Custom error types

**Key Concepts:**
- All errors propagated with full context
- Different error types for different scenarios
- Graceful degradation strategies

### 4. Lifecycle Management (`lifecycle.ts`)

Worker lifecycle and process management:

- Manual vs automatic termination
- Sync and async disposables
- Managing multiple worker instances
- Accessing the underlying child process
- Worker pools
- Graceful shutdown patterns

**Key Concepts:**
- Multiple lifecycle management patterns
- Process access via `$process` property
- Coordinating multiple workers
- Resource cleanup strategies

## Common Patterns

### Pattern 1: Automatic Cleanup

Always prefer `await using` for automatic cleanup:

```typescript
await using worker = await procxy(MyClass, './my-class.js');
// Use worker...
// Automatically terminated when scope exits
```

### Pattern 2: Error Handling with Retry

```typescript
async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  let lastError: Error;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 100 * attempt));
      }
    }
  }
  throw lastError!;
}
```

### Pattern 3: Worker Pool

```typescript
const workers = await Promise.all(
  Array.from({ length: 4 }, (_, i) =>
    procxy(Worker, './worker.js', undefined, `worker-${i}`)
  )
);

// Distribute work
for (const task of tasks) {
  const worker = workers[task.id % workers.length];
  await worker.process(task);
}

// Cleanup
await Promise.all(workers.map(w => w.$terminate()));
```

### Pattern 4: Progress Tracking

```typescript
await using worker = await procxy(ProgressWorker, './worker.js');

worker.on('progress', ({ current, total }) => {
  console.log(`Progress: ${current}/${total}`);
});

await worker.processItems(items);
```

## Advanced Examples

For more advanced usage, see:

- **Type Safety**: The Procxy type system automatically filters non-serializable methods
- **Constructor Arguments**: Pass any JSON-serializable arguments to the class constructor
- **Configuration**: Customize timeout, retries, environment variables, working directory
- **Process Control**: Access the underlying ChildProcess for advanced control

## Troubleshooting

### Example won't run

Ensure you're in the project root and have installed dependencies:

```bash
pnpm install
pnpm tsx examples/basic-usage.ts
```

### Module path errors

Examples reference `./examples/[filename].ts` as the module path. This works because:
1. TypeScript compiles to `dist/examples/[filename].js`
2. Node.js resolves the compiled version at runtime

For your own code, use absolute paths or paths relative to your entry point.

### Type errors

Examples use TypeScript. Ensure your `tsconfig.json` has:
- `"target": "ES2022"` or higher
- `"lib": ["ES2022"]` or higher
- `"module": "commonjs"` or `"node16"`

## Contributing

Found a bug in an example or want to add a new one? Please see [CONTRIBUTING.md](../CONTRIBUTING.md).

## License

MIT
