# Changelog

## 0.1.0-alpha.8

### Minor Changes

- resolver fixes

## 0.1.0-alpha.7

### Minor Changes

- serialization fixes

## 0.1.0-alpha.6

### Minor Changes

- pkg cleanup

## 0.1.0-alpha.5

### Patch Changes

- ef9091c: Fix module resolution and EventEmitter support in subprocess mode

  - **Module Resolution**: Fixed `.ts`/`.js` extension resolution to support both TypeScript source files and compiled JavaScript output. The resolver now checks for both extensions and falls back appropriately, enabling procxy to work in both development (tsx) and production (compiled) environments.

  - **EventEmitter Support**: Enhanced child proxy to properly handle classes extending EventEmitter by filtering out function assignments during property synchronization. This prevents "could not be cloned" errors when EventEmitter's internal event handling setup tries to assign functions across IPC boundaries.

  These fixes enable classes that extend EventEmitter to run in subprocess mode and ensure compatibility with various execution environments.

## 0.1.0-alpha.3

### Minor Changes

- added support for passing sockets

## 0.1.0-alpha.2

- **Advanced Serialization Support (V8 Structured Clone)**

  - Support for `BigInt`, `ArrayBuffer`, `TypedArray`, `DataView`, `Date`, `Map`, `Set`, `Error` objects
  - Nested structure support with recursive serialization/deserialization
  - Configurable via `serialization: 'advanced'` option with `as const` for type inference

- **Handle Passing Support (IPC File Descriptors)**

  - Type-safe handle passing with conditional `$sendHandle()` method
  - Only available when `supportHandles: true` option is explicitly set
  - Used for passing TCP sockets, UDP sockets, server handles, or other OS-level descriptors
  - Implemented via `child.send()` with third parameter in Node.js IPC protocol

- **Generic Type Improvements**

  - Added `SupportHandles` generic parameter to `Procxy<T, Mode, SupportHandles>` type
  - Conditional `$sendHandle()` method visibility based on `SupportHandles` generic
  - Added `SupportHandles` generic parameter to `ProcxyOptions<Mode, SupportHandles>`
  - Improved type inference with proper literal type handling via `as const`

- **Documentation & Examples**
  - 5 comprehensive examples for advanced serialization and handle passing
  - Buffer processing with BigInt calculations
  - Error preservation across process boundaries
  - Socket transfer using handle passing
  - Collection processing with Map/Set support

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
