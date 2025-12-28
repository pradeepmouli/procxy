# Procxy Constitution

## Core Principles

### I. Ergonomics First
The API must be intuitive and minimize cognitive load. The complexity of Inter-Process Communication (IPC) must be completely abstracted away. A developer should interact with a remote object using standard method calls and property accesses, as if the object were instantiated locally in the same process.

**In Practice**:
- No manual message passing or event handling exposed to the user
- Standard async/await patterns for all interactions
- No special syntax or wrappers required for method invocation
- Error handling follows standard JavaScript/TypeScript conventions

### II. Type Safety (NON-NEGOTIABLE)
TypeScript is the law of the land. All interactions across the process boundary must be fully typed at compile time. The library must leverage TypeScript's type system to provide IDE autocomplete, type checking, and refactoring support.

**In Practice**:
- Generic type parameter `<T>` captures the remote object's interface
- Mapped types automatically convert synchronous methods to async
- Type inference works correctly for method arguments and return values
- No use of `any` type in public APIs

### III. Transparency
The proxy should behave as close to the real object as possible. Developers should be able to reason about remote objects using their existing mental model of JavaScript objects.

**In Practice**:
- Method calls on the proxy invoke methods on the remote instance
- Return values are serialized and returned to the caller
- Errors thrown in the child process are propagated to the parent with stack traces preserved
- Property access (where supported) returns the property value
- The child process lifecycle is manageable but automatic by default

### IV. Asynchrony
Due to the inherent nature of IPC, all interactions are asynchronous. The library embraces this reality and exposes all remote operations as Promises.

**In Practice**:
- Synchronous methods on the remote object are exposed as async methods on the proxy
- All method calls return `Promise<T>` where T is the original return type
- Property access returns `Promise<T>` where T is the property type
- Support for `async/await` syntax throughout

### V. Reliability
The library must handle edge cases, timeouts, and errors gracefully. It should not leave orphaned processes or unresolved promises.

**In Practice**:
- Configurable timeouts for method calls (default: 30 seconds)
- Automatic cleanup of child processes when parent exits
- Clear error messages with actionable information
- Request/response correlation to support concurrent operations
- Graceful handling of child process crashes

### VI. Simplicity
Start simple. Follow YAGNI principles. Avoid premature optimization or feature creep.

**In Practice**:
- Core API is a single function: `procxy(Constructor, ...args)` or `procxy(Constructor, options, ...args)`
- Minimal configuration options, smart defaults
- No complex DSL or configuration files required
- Clear separation between parent and child process concerns
- Automatic module path detection eliminates boilerplate in 90% of use cases
- Explicit fallback (`modulePath` option) covers edge cases without complexity

## Scope and Limitations

### Supported Use Cases
- Offloading CPU-intensive tasks to separate processes
- Isolating untrusted code in sandboxed processes
- Parallelizing work across multiple processes
- Creating resilient services that can restart on failure
- Working with EventEmitter-based classes for progress tracking and event streaming
- Automatic module path detection for ergonomic API usage

### Explicit Non-Goals
- **Complex Object Graphs**: Passing deeply nested objects with circular references is not supported
- **Function Arguments**: Functions cannot be serialized and passed as arguments
- **Streaming Data**: Large data transfers should use alternative mechanisms (streams, shared memory)
- **Browser Support**: This is Node.js only; no Web Workers support
- **Bidirectional Callbacks**: General parent-to-child callbacks are not supported (EventEmitter pattern is the exception)
- **Property Setters**: Write access to remote properties is not supported in v1 (read-only property access may be considered for future versions)
- **Source Map Support**: Module path detection from bundled/transpiled code requires explicit `modulePath` option

### Technical Constraints
- **Serialization**: Arguments and return values must be JSON-serializable (constructor arguments included)
- **Constructor Arguments**: All constructor arguments must be serializable; non-serializable dependencies must be initialized separately in the child process
- **Node.js Version**: Requires Node.js >= 18.0.0 for modern child_process APIs
- **Module System**: Supports ES modules (ESM) and CommonJS; auto-detection works for both
- **IPC Transport**: Uses Node.js built-in IPC channel (child_process.fork)
- **Module Path Detection**: Automatic via Error stack trace inspection; explicit override available via `modulePath` option
- **Named Classes Required**: Constructors must be named classes (not anonymous) for automatic module resolution
- **EventEmitter Support**: When a class extends EventEmitter, events are automatically forwarded from child to parent with type preservation

## Development Standards

### Code Quality
- All code must adhere to guidelines in AGENTS.md
- TypeScript strict mode enabled
- 100% type coverage (no `any` types)
- Public APIs documented with JSDoc
- Private implementation details not documented

### Testing Requirements
- Unit tests for all public APIs using vitest
- Integration tests for parent-child communication
- Test coverage > 90%
- Error scenarios must be tested
- Timeout and edge cases must be tested

### Documentation
- README with quick start guide
- API reference in SPECIFICATION.md
- Conceptual examples for common use cases
- Migration guide for breaking changes (when applicable)

## Security Considerations

### Process Isolation
- Child processes run with same privileges as parent (no privilege escalation)
- Environment variables can be controlled via options
- Working directory can be isolated via options

### Input Validation
- Method names and arguments are validated before IPC
- Malformed messages are rejected with clear errors
- Timeout prevents indefinite blocking on malicious child

### Error Information
- Stack traces may reveal file paths and structure
- Error messages should not leak sensitive information
- Consider security implications when exposing services

## Architecture Decisions

### Module Resolution Strategy
The library uses **Error stack trace inspection** as the primary mechanism for automatic module path detection:

- Captures stack trace at `procxy()` call site
- Parses caller file path from stack frames
- Handles both ESM (`file://`) and CommonJS paths
- Falls back to explicit `modulePath` option when auto-detection fails

**Rationale**: Provides ergonomic API for 90% of cases while maintaining reliability through explicit override.

**Known Limitations**:
- Bundled/minified code may require explicit `modulePath`
- REPL/eval environments require explicit `modulePath`
- Decorator wrappers may add stack frames (handled via frame filtering)

### EventEmitter Integration
Classes extending `EventEmitter` receive automatic event forwarding:

- Runtime prototype chain inspection detects EventEmitter inheritance
- Events emitted in child process are forwarded to parent via IPC
- Parent proxy implements EventEmitter interface with type preservation
- Event listeners registered on parent proxy receive child events transparently

**Rationale**: Many Node.js patterns use EventEmitter for async notifications. Supporting this makes procxy work seamlessly with existing codebases.

### Property Access Decision
**v1.0 supports methods only**. Property access is not supported in initial release.

**Rationale**:
- Methods cover 95% of use cases
- Property access introduces ambiguity (getters, setters, nested objects)
- Can be added in future versions if demand exists

**Future Consideration**: Read-only property access via Promise-based getters may be added if there's a clear, ergonomic approach.

### Timeout and Retry Mechanism
- Default timeout: 30 seconds per method call
- Retry attempts: 3 before rejection
- Timeout rejection does not kill child process (method continues in background)
- Child process crash causes immediate rejection of all pending promises (fail-fast)

**Rationale**: Balances responsiveness with tolerance for transient issues. Fail-fast on crashes prevents cascading failures.

## Governance

This constitution supersedes all other practices and guidelines. All PRs, code reviews, and design decisions must verify compliance with these principles.

When principles conflict, the following priority order applies:
1. Type Safety (NON-NEGOTIABLE)
2. Reliability
3. Ergonomics First
4. Transparency
5. Asynchrony
6. Simplicity

Amendments to this constitution require:
- Documentation of rationale and impact
- Approval from project maintainers
- Migration plan for breaking changes
- Update to version number

**Version**: 1.1.0 | **Ratified**: 2025-12-27 | **Last Amended**: 2025-12-28
