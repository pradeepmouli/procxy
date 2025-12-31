# Changelog

## 0.1.0-alpha.2

- advanced serialization support

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0-alpha.1] - 2024-12-29

### Added

- **Core Features**

  - Process-based proxying for TypeScript/JavaScript classes
  - Type-safe method invocation with full IntelliSense support
  - Transparent IPC communication between parent and child processes
  - Constructor arguments support for remote class instantiation

- **EventEmitter Support**

  - Automatic event forwarding from child to parent process
  - Full EventEmitter API compatibility
  - Support for custom events and event listeners

- **Lifecycle Management**

  - Manual termination via `$terminate()` method
  - Automatic cleanup with ES2024 disposables (`using`/`await using`)
  - Graceful process termination and resource cleanup
  - Access to underlying child process via `$process` property

- **Configuration Options**

  - Configurable timeouts per method call
  - Automatic retry logic for failed operations
  - Custom environment variables for child processes
  - Working directory customization
  - Command line arguments support

- **Error Handling**

  - Complete error propagation from child to parent
  - Stack trace preservation across process boundaries
  - Specialized error types:
    - `TimeoutError` for method call timeouts
    - `ChildCrashedError` for unexpected process exits
    - `ModuleResolutionError` for module loading failures
    - `SerializationError` for non-JSON-serializable data
    - `OptionsValidationError` for invalid configuration

- **Type Safety**

  - Advanced mapped types with `Procxy<T>`
  - Automatic filtering of non-serializable methods
  - Support for optional parameters
  - Full TypeScript 5.0+ compatibility

- **Performance**

  - Method call overhead <10ms (average 0.04-0.06ms)
  - No memory leaks after 1000+ sequential calls
  - Efficient IPC message handling
  - Minimal bundle size (~26KB unminified, ~6KB gzipped)

- **Documentation**

  - Comprehensive README with examples
  - API documentation via TypeDoc
  - 4 detailed example files:
    - `basic-usage.ts` - Fundamental usage patterns
    - `event-emitter.ts` - Event forwarding examples
    - `error-handling.ts` - Error handling strategies
    - `lifecycle.ts` - Process lifecycle management
  - Contributing guidelines

- **Testing**
  - 223 tests with 88.57% code coverage
  - Integration tests for all major features
  - Unit tests for core components
  - Performance benchmarks
  - Memory leak detection tests

### Performance Metrics

- Average method call overhead: **0.04-0.06ms**
- Memory growth after 1000 calls: **<3MB**
- Bundle size: **26KB** unminified, **6KB** gzipped
- Test coverage: **88.57%**
- Process initialization: **~150ms**

### Requirements

- Node.js >= 20.0.0
- TypeScript >= 5.0.0 (for TypeScript projects)
- pnpm >= 9.0.0 (for development)

### Architecture

- **Parent Process**: Manages proxy instances and IPC communication
- **Child Process**: Runs class instances in isolation
- **IPC Protocol**: JSON-based message protocol for method calls and events
- **Type System**: Advanced mapped types for type-safe proxy generation

### Security

- Complete process isolation for untrusted code
- Configurable timeouts prevent runaway processes
- Validated serialization prevents code injection

---

## [Unreleased]

### Future Plans

- Worker threads support (in addition to child_process)
- Worker pooling for high-throughput scenarios
- Transferable objects support for zero-copy data passing
- Browser support via Web Workers
- Performance optimizations
- Additional configuration options

---

**Legend**:

- `Added` for new features
- `Changed` for changes in existing functionality
- `Deprecated` for soon-to-be removed features
- `Removed` for now removed features
- `Fixed` for any bug fixes
- `Security` for vulnerability fixes

[0.1.0-alpha.1]: https://github.com/pradeepmouli/procxy/releases/tag/v0.1.0-alpha.1
