# Feature Specification: Procxy - Process Proxy Library

**Feature Branch**: `001-procxy-core-library`
**Created**: 2025-12-27
**Status**: Draft
**Input**: User description: "Design a library that can be used to instantiate an object in child process and interact with the object as if it were imported and instantiated directly"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Basic Remote Method Invocation (Priority: P1)

A developer needs to offload a CPU-intensive computation to a separate process to avoid blocking the main event loop. They want to call methods on the remote object just like a local object, using async/await.

**Why this priority**: This is the core value proposition of the library. If this doesn't work, nothing else matters. This single story delivers immediate value - the ability to run code in isolation.

**Independent Test**: Can be fully tested by creating a simple class with a synchronous method, exposing it in a child process, calling it from the parent, and verifying the return value. Delivers the complete basic workflow.

**Acceptance Scenarios**:

1. **Given** a class `Calculator` with a method `add(a: number, b: number): number` exported from a module, **When** I call `await procxy(Calculator)` and invoke `await calculator.add(2, 3)`, **Then** I receive `5` as the result
2. **Given** a remote object with an async method, **When** I call that method through the proxy, **Then** the Promise resolves with the correct value
3. **Given** a remote method that throws an error, **When** I call that method through the proxy, **Then** the Promise rejects with an error containing the original message and stack trace

---

### User Story 2 - Lifecycle Management (Priority: P2)

A developer wants to control when the child process starts and stops. They need to clean up resources properly when done, and handle cases where the parent process exits.

**Why this priority**: Essential for production use. Memory leaks from orphaned processes are unacceptable. This can be tested independently after P1 is working.

**Independent Test**: Can be tested by creating a proxy, verifying the child process is running, calling `$terminate()`, and confirming the process exits. Also test that processes are cleaned up on parent exit.

**Acceptance Scenarios**:

1. **Given** a procxy instance, **When** I call `proxy.$terminate()`, **Then** the child process exits gracefully and subsequent method calls fail with a clear error
2. **Given** multiple procxy instances, **When** the parent process receives SIGTERM, **Then** all child processes are terminated automatically
3. **Given** a child process that crashes, **When** I try to call a method on the proxy, **Then** I receive a clear error indicating the child is no longer available

---

### User Story 3 - Configurable Timeouts (Priority: P3)

A developer has methods with varying execution times. Some complete in milliseconds, others might take minutes. They need to configure timeouts appropriately.

**Why this priority**: Prevents hanging on stuck child processes, but the default timeout (30s) covers most use cases. Can be added after core functionality works.

**Independent Test**: Can be tested by creating a method that sleeps, setting a short timeout, and verifying the promise rejects with a timeout error.

**Acceptance Scenarios**:

1. **Given** a procxy with `timeout: 5000` option, **When** a remote method takes longer than 5 seconds, **Then** the Promise rejects with a TimeoutError
2. **Given** a procxy with default timeout, **When** a method completes within 30 seconds, **Then** the Promise resolves normally
3. **Given** a long-running operation, **When** I set a high timeout value, **Then** the operation completes successfully

---

### User Story 4 - Type-Safe Method Calls (Priority: P1)

A TypeScript developer wants full type safety when calling remote methods. They should get autocomplete for method names, type checking for arguments, and typed return values.

**Why this priority**: Type safety is a core principle (NON-NEGOTIABLE). This must work from day one. Without types, the library loses its primary advantage over manual IPC.

**Independent Test**: This is validated at compile time. Tests verify that incorrect types are caught by TypeScript and correct types pass.

**Acceptance Scenarios**:

1. **Given** a class `Service` with method `process(data: string): number`, **When** I call `await procxy(Service)`, **Then** TypeScript provides autocomplete for `process` method
2. **Given** a typed proxy, **When** I try to call a method with wrong argument types, **Then** TypeScript compilation fails
3. **Given** a typed proxy method that returns `number`, **When** I await the method call, **Then** TypeScript infers the type as `number`

---

### User Story 5 - Custom Child Process Options (Priority: P3)

A developer needs to configure the child process environment - different working directory, custom environment variables, or command line arguments.

**Why this priority**: Important for advanced use cases and production deployments, but not needed for basic functionality. Can be added after core features are stable.

**Independent Test**: Can be tested by spawning a child with custom env vars and verifying they are accessible in the child process.

**Acceptance Scenarios**:

1. **Given** `await procxy(Worker, { env: { API_KEY: 'secret' } })`, **When** the child process reads `process.env.API_KEY`, **Then** it receives `'secret'`
2. **Given** `await procxy(Worker, { cwd: '/tmp' })`, **When** the child process reads `process.cwd()`, **Then** it returns `'/tmp'`
3. **Given** `await procxy(Worker, { args: ['--mode', 'production'] })`, **When** the child process reads `process.argv`, **Then** it contains `'--mode'` and `'production'`

---

### User Story 6 - EventEmitter Integration (Priority: P2)

A developer has a class that extends EventEmitter and emits events during long-running operations. They want these events to be transparently forwarded to the parent process.

**Why this priority**: Many Node.js patterns use EventEmitter for progress updates, status changes, and async notifications. Supporting this makes procxy work seamlessly with existing codebases.

**Independent Test**: Can be tested by creating a class that extends EventEmitter, emitting events from child, and verifying listeners in parent receive them.

**Acceptance Scenarios**:

1. **Given** a class extending `EventEmitter<{ progress: (percent: number) => void }>`, **When** the child emits `progress` event, **Then** parent listeners receive the event with correct data
2. **Given** a proxy of EventEmitter-based class, **When** I call `.on('event', handler)` in parent, **Then** the handler is invoked when child emits the event
3. **Given** a proxy with multiple event listeners, **When** child emits an event, **Then** all registered listeners in parent are called

---

### Edge Cases

- What happens when a method is called while a previous call is still in progress? (Answer: Should work - concurrent calls are supported via message ID correlation)
- What happens if the child process crashes mid-call? (Answer: Promise rejects with error indicating process exit)
- What happens if parent tries to send non-serializable data? (Answer: Error thrown immediately when calling the method)
- What happens if the module path cannot be determined from the constructor? (Answer: Require explicit module path via options)
- What happens if the child fails to import the module? (Answer: Error thrown during initialization and propagated to parent)
- What happens if constructor arguments are needed? (Answer: Pass via `constructorArgs` option)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a `procxy<T>(constructor: new (...args: any[]) => T, options?: ProcxyOptions): Promise<Procxy<T>>` function that spawns a child process with a generic agent module
- **FR-002**: System MUST create Proxy objects on both parent (for IPC message sending) and child (for method invocation) sides
- **FR-003**: System MUST serialize method arguments using JSON or structured clone
- **FR-004**: System MUST deserialize return values and resolve the Promise with the result
- **FR-005**: System MUST propagate errors from child to parent, preserving error message, name, and stack trace
- **FR-006**: System MUST support concurrent method calls with correct response correlation
- **FR-007**: System MUST provide a `$terminate()` method to explicitly kill the child process
- **FR-008**: System MUST provide a `$process` property to access the underlying ChildProcess instance
- **FR-009**: System MUST determine the module path from the constructor and send it to the child for dynamic import and instantiation
- **FR-010**: System MUST handle child process crashes by rejecting pending promises
- **FR-011**: System MUST implement timeout mechanism with configurable duration (default: 30000ms)
- **FR-012**: System MUST clean up child processes when parent process exits
- **FR-013**: System MUST generate TypeScript type definitions that map `T` methods to `Promise<T>`
- **FR-014**: System MUST validate that method names are strings and valid identifiers
- **FR-015**: System MUST use unique message IDs (UUIDs) for request/response correlation
- **FR-016**: System MUST support explicit module path override via options when automatic detection fails
- **FR-017**: System MUST bridge EventEmitter events when target class extends EventEmitter, forwarding events from child to parent
- **FR-018**: System MUST use stack trace inspection to automatically detect module path from constructor
- **FR-019**: System MUST validate that constructor arguments are JSON-serializable before sending to child
- **FR-020**: System MUST implement retry logic (default: 3 attempts) before rejecting timeout promises
- **FR-021**: System MUST terminate and reject all pending promises when child process crashes (fail fast)

### Non-Functional Requirements

- **NFR-001**: Method call latency MUST be under 10ms overhead (excluding actual method execution time)
- **NFR-002**: Memory usage MUST not grow unbounded with long-running processes
- **NFR-003**: Error messages MUST be clear and actionable
- **NFR-004**: TypeScript types MUST provide accurate autocomplete in VS Code
- **NFR-005**: Bundle size MUST be under 50KB (minified)
- **NFR-006**: Zero external runtime dependencies (only dev dependencies allowed)
- **NFR-007**: Compatible with Node.js >= 18.0.0

### Key Entities

- **Parent Proxy**: The proxy object returned to parent, typed as `Procxy<T>`, which intercepts method calls and translates them to IPC messages, and also acts as EventEmitter if T extends EventEmitter
- **Child Agent**: A generic wrapper module that runs in the child process, receives initialization messages, and dynamically imports and instantiates the target class
- **Child Proxy**: A proxy in the child process that receives IPC messages and invokes methods on the actual instance
- **Constructor**: The class constructor passed to `procxy()`, used to extract module path via stack trace inspection
- **Module Resolver**: Utility that detects module path using Error stack traces and `import.meta.url` or `__filename`
- **ProcxyOptions**: Configuration object with properties: `args`, `env`, `cwd`, `timeout`, `retries`, `modulePath`
- **Init Message**: Initial IPC message sent from parent to child with structure: `{ type: 'INIT', modulePath, className, constructorArgs }`
- **Request Message**: IPC message sent from parent to child with structure: `{ id, type: 'CALL', prop, args }`
- **Response Message**: IPC message sent from child to parent with structure: `{ id, type: 'RESULT' | 'ERROR', value?, error? }`
- **Event Message**: IPC message sent from child to parent for EventEmitter events: `{ type: 'EVENT', eventName, args }`

## Technical Design *(optional but recommended)*

### Type Definitions

```typescript
// Parent API
export interface ProcxyOptions {
  args?: string[];           // Arguments to child process
  env?: NodeJS.ProcessEnv;   // Environment variables
  cwd?: string;              // Working directory
  timeout?: number;          // Method call timeout (ms, default: 30000)
  retries?: number;          // Retry attempts before failing (default: 3)
  modulePath?: string;       // Explicit module path (overrides auto-detection)
}

export type Procxy<T> = {
  [K in keyof T]: T[K] extends (...args: infer A) => infer R
    ? (...args: A) => Promise<Awaited<R>>
    : T[K]; // Properties return Promise<PropertyType>
} & {
  $terminate(): void;
  $process: ChildProcess;
};

export function procxy<T>(
  constructor: new (...args: any[]) => T,
  ...constructorArgs: any[]
): Promise<Procxy<T>>;

export function procxy<T>(
  constructor: new (...args: any[]) => T,
  options: ProcxyOptions,
  ...constructorArgs: any[]
): Promise<Procxy<T>>;
```

### Communication Protocol

**Init Message (Parent → Child, sent once on startup)**
```typescript
interface InitMessage {
  type: 'INIT';
  modulePath: string;      // Path to module to import
  className: string;       // Name of class to instantiate
  constructorArgs: any[];  // Arguments for constructor (must be JSON-serializable)
}
```

**Event Message (Child → Parent, for EventEmitter support)**
```typescript
interface EventMessage {
  type: 'EVENT';
  eventName: string;       // Name of the event
  args: any[];             // Event arguments
}
```

**Message Format (Parent → Child)**
```typescript
interface Request {
  id: string;          // UUID v4
  type: 'CALL';        // Only CALL supported in v1
  prop: string;        // Method name
  args: any[];         // Arguments array
}
```

**Message Format (Child → Parent)**
```typescript
interface Response {
  id: string;          // Matches Request.id
  type: 'RESULT' | 'ERROR';
  value?: any;         // Return value (if RESULT)
  error?: {            // Error details (if ERROR)
    message: string;
    stack?: string;
    name: string;
    code?: string;
  };
}
```

### Architecture

```
┌─────────────────┐                       ┌─────────────────┐
│     Parent      │                       │      Child      │
│    Process      │                       │     Process     │
├─────────────────┤                       ├─────────────────┤
│                 │                       │                 │
│ procxy(Calc)    │──fork(agent.js)──────▶│  Agent Module   │
│      ↓          │                       │       ↓         │
│ Extract module  │──{INIT,modulePath}──▶│ import(module)  │
│  path & class   │                       │       ↓         │
│      ↓          │                       │  new Calc()     │
│ ParentProxy     │                       │       ↓         │
│      ↓          │                       │  ChildProxy     │
│ calc.add(2,3)   │──{id,prop,args}─────▶│  Proxy trap     │
│      ↓          │                       │       ↓         │
│   Promise       │                       │ instance.add()  │
│      ↓          │◀─{id,value:5}────────│       ↓         │
│  resolve(5)     │                       │   return 5      │
└─────────────────┘                       └─────────────────┘
```

### File Structure

```
src/
  index.ts           # Public exports
  parent.ts          # procxy() implementation - parent proxy
  agent.ts           # Child agent module - receives init, imports and instantiates
  child-proxy.ts     # Child proxy implementation
  protocol.ts        # Message type definitions
  errors.ts          # Custom error classes
  module-resolver.ts # Extract module path from constructor
```

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Developers can set up and use procxy with less than 10 lines of code (parent + child)
- **SC-002**: TypeScript autocomplete works correctly in VS Code for remote method calls
- **SC-003**: Method call overhead is measurable at under 10ms for simple methods
- **SC-004**: Zero memory leaks after 1000 sequential method calls in a long-running process
- **SC-005**: Test coverage exceeds 90% for all public APIs
- **SC-006**: Documentation includes runnable examples that work without modification
- **SC-007**: Error messages clearly indicate whether the problem is in parent or child
- **SC-008**: Child processes are automatically cleaned up 100% of the time when parent exits
