# Enhancement Specification: Deno and Bun Runtime Support

**Status:** Draft
**Version:** 1.0
**Author:** Claude
**Date:** 2025-12-31

## Executive Summary

This specification proposes extending procxy to support Deno and Bun runtimes in addition to Node.js. Both runtimes offer IPC capabilities that can be leveraged to provide the same transparent class proxying API across different JavaScript environments.

## Table of Contents

1. [Background](#background)
2. [Feasibility Assessment](#feasibility-assessment)
3. [Technical Approach](#technical-approach)
4. [API Design](#api-design)
5. [Implementation Strategy](#implementation-strategy)
6. [Challenges and Trade-offs](#challenges-and-trade-offs)
7. [References](#references)

---

## Background

### Motivation

The JavaScript ecosystem has evolved beyond Node.js with the emergence of Deno and Bun:
- **Deno**: Security-first runtime with built-in TypeScript support and modern APIs
- **Bun**: Performance-focused runtime with fast startup times and better developer experience

Supporting these runtimes would allow procxy to:
1. Reach a broader developer audience
2. Leverage runtime-specific performance benefits (e.g., Bun's faster startup)
3. Enable use in Deno's secure-by-default environment
4. Provide consistent API across all major JavaScript runtimes

### Goals

1. **Runtime Parity**: Same `procxy()` API works on Node.js, Bun, and Deno
2. **Automatic Detection**: Runtime is detected automatically, no configuration needed
3. **Performance**: Leverage each runtime's strengths (Bun speed, Deno security)
4. **Type Safety**: Full TypeScript support across all runtimes

---

## Feasibility Assessment

### Bun: HIGHLY FEASIBLE ✅

**IPC Capabilities:**
- Native [`Bun.spawn()`](https://bun.sh/guides/process/ipc) with IPC channel support
- Compatible with Node.js [`child_process.fork()`](https://bun.com/reference/node/child_process/fork) API
- Same `process.send()` and `process.on("message")` interface
- JSC serialization API (similar to V8 structured clone)

**Current Limitations:**
- IPC currently only works between Bun processes (not mixed Bun/Node)
- Must use `bun` executable for child processes

**Implementation Complexity:** **LOW**
- Minimal code changes required
- Protocol remains identical
- Mostly runtime detection + use `Bun.spawn()` instead of `fork()`

**Example:**
```typescript
// Parent process (Bun)
const child = Bun.spawn(["bun", "child.ts"], {
  ipc(message, childProc) {
    handleResponse(message);
  },
});
child.send({ type: 'CALL', method: 'add', args: [5, 3] });

// Child process (Bun)
process.on("message", (msg) => {
  const result = instance[msg.method](...msg.args);
  process.send({ type: 'RESULT', value: result });
});
```

**Verdict:** Can be implemented with **minimal effort** - mostly adapter layer changes.

---

### Deno: MODERATELY FEASIBLE ⚙️

**IPC Capabilities:**

**Option 1: Node.js Compatibility Layer**
- [Deno supports `child_process.fork()`](https://docs.deno.com/api/node/child_process/)
- Has `ChildProcess.prototype.send()` API
- Requires `--allow-run` permission and potentially others
- May have incomplete compatibility edge cases

**Option 2: Native Deno.Command (Recommended)**
- Uses `Deno.Command` with piped stdin/stdout
- [Manual JSON message passing](https://github.com/denoland/deno/issues/2585) via line-delimited JSON
- More control and fully native approach
- Requires custom protocol implementation

**Implementation Complexity:** **MEDIUM**
- Two possible approaches (Node compat vs native)
- Permissions system adds complexity
- Module resolution differs (URLs vs file paths)
- Need custom IPC protocol for native approach

**Example (Native Deno):**
```typescript
// Parent process (Deno)
const command = new Deno.Command("deno", {
  args: ["run", "--allow-all", "child.ts"],
  stdin: "piped",
  stdout: "piped",
});
const child = command.spawn();

// Send messages as JSON lines to stdin
const encoder = new TextEncoder();
const message = JSON.stringify({ type: 'CALL', method: 'add', args: [5, 3] }) + '\n';
await child.stdin.getWriter().write(encoder.encode(message));

// Read responses from stdout
const decoder = new TextDecoder();
for await (const chunk of child.stdout) {
  const lines = decoder.decode(chunk).split('\n');
  for (const line of lines) {
    if (line) {
      const response = JSON.parse(line);
      handleResponse(response);
    }
  }
}
```

**Verdict:** Feasible but requires more work. Two implementation paths:
1. **Quick**: Use Node compat layer (easier but less "Deno-native")
2. **Better**: Implement native `Deno.Command` with JSON protocol (more work, better long-term)

---

## Technical Approach

### Runtime Abstraction Layer

Create a runtime adapter pattern to abstract subprocess creation and IPC:

```typescript
// src/runtime/adapter.ts

/**
 * Unified interface for subprocess IPC across runtimes
 */
interface RuntimeAdapter {
  /**
   * Detect the current runtime
   */
  static detect(): 'node' | 'bun' | 'deno';

  /**
   * Spawn a child process with IPC channel
   */
  spawn(options: SpawnOptions): ChildHandle;

  /**
   * Get runtime-specific configuration
   */
  getConfig(): RuntimeConfig;
}

/**
 * Unified child process handle
 */
interface ChildHandle {
  /**
   * Send a message to the child process
   */
  send(message: any): void;

  /**
   * Listen for messages from the child process
   */
  on(event: 'message', handler: (msg: any) => void): void;
  on(event: 'error', handler: (err: Error) => void): void;
  on(event: 'exit', handler: (code: number) => void): void;

  /**
   * Terminate the child process
   */
  kill(): void;

  /**
   * Access the underlying process (runtime-specific)
   */
  raw: any;
}

interface SpawnOptions {
  modulePath: string;
  className: string;
  constructorArgs: any[];
  options: ProcxyOptions;
  serialization: 'json' | 'advanced';
}

interface RuntimeConfig {
  runtime: 'node' | 'bun' | 'deno';
  executable: string;  // 'node', 'bun', or 'deno'
  supportsAdvancedSerialization: boolean;
  requiresPermissions: boolean;
}
```

### Runtime Adapters

#### Node.js Adapter

```typescript
// src/runtime/node-adapter.ts
import { fork } from 'child_process';

export class NodeAdapter implements RuntimeAdapter {
  static detect(): 'node' | 'bun' | 'deno' {
    return 'node';
  }

  spawn(options: SpawnOptions): ChildHandle {
    const child = fork(agentPath, args, {
      serialization: options.serialization,
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
      env: options.options.env,
      cwd: options.options.cwd,
    });

    return new NodeChildHandle(child);
  }

  getConfig(): RuntimeConfig {
    return {
      runtime: 'node',
      executable: 'node',
      supportsAdvancedSerialization: true,
      requiresPermissions: false,
    };
  }
}

class NodeChildHandle implements ChildHandle {
  constructor(private child: ChildProcess) {}

  send(message: any): void {
    this.child.send(message);
  }

  on(event: string, handler: Function): void {
    this.child.on(event, handler as any);
  }

  kill(): void {
    this.child.kill();
  }

  get raw() {
    return this.child;
  }
}
```

#### Bun Adapter

```typescript
// src/runtime/bun-adapter.ts

export class BunAdapter implements RuntimeAdapter {
  static detect(): 'node' | 'bun' | 'deno' {
    return 'bun';
  }

  spawn(options: SpawnOptions): ChildHandle {
    const messageHandlers = new Set<Function>();
    const errorHandlers = new Set<Function>();
    const exitHandlers = new Set<Function>();

    const child = Bun.spawn(["bun", agentPath, ...args], {
      ipc(message, childProc) {
        messageHandlers.forEach(handler => handler(message));
      },
      env: options.options.env,
      cwd: options.options.cwd,
    });

    // Monitor exit
    child.exited.then((exitCode) => {
      exitHandlers.forEach(handler => handler(exitCode));
    });

    return new BunChildHandle(child, messageHandlers, errorHandlers, exitHandlers);
  }

  getConfig(): RuntimeConfig {
    return {
      runtime: 'bun',
      executable: 'bun',
      supportsAdvancedSerialization: true,  // JSC serialization
      requiresPermissions: false,
    };
  }
}

class BunChildHandle implements ChildHandle {
  constructor(
    private child: any,
    private messageHandlers: Set<Function>,
    private errorHandlers: Set<Function>,
    private exitHandlers: Set<Function>
  ) {}

  send(message: any): void {
    this.child.send(message);
  }

  on(event: string, handler: Function): void {
    if (event === 'message') {
      this.messageHandlers.add(handler);
    } else if (event === 'error') {
      this.errorHandlers.add(handler);
    } else if (event === 'exit') {
      this.exitHandlers.add(handler);
    }
  }

  kill(): void {
    this.child.kill();
  }

  get raw() {
    return this.child;
  }
}
```

#### Deno Adapter (Native Approach)

```typescript
// src/runtime/deno-adapter.ts

export class DenoAdapter implements RuntimeAdapter {
  static detect(): 'node' | 'bun' | 'deno' {
    return 'deno';
  }

  spawn(options: SpawnOptions): ChildHandle {
    // Build Deno command with required permissions
    const permissions = [
      '--allow-read',
      '--allow-write',
      '--allow-env',
      '--allow-net',  // If needed
    ];

    const command = new Deno.Command("deno", {
      args: ["run", ...permissions, agentPath, ...args],
      stdin: "piped",
      stdout: "piped",
      stderr: "piped",
      env: options.options.env,
      cwd: options.options.cwd,
    });

    const child = command.spawn();

    return new DenoChildHandle(child);
  }

  getConfig(): RuntimeConfig {
    return {
      runtime: 'deno',
      executable: 'deno',
      supportsAdvancedSerialization: false,  // Use JSON over stdio
      requiresPermissions: true,
    };
  }
}

class DenoChildHandle implements ChildHandle {
  private encoder = new TextEncoder();
  private decoder = new TextDecoder();
  private messageHandlers = new Set<Function>();
  private errorHandlers = new Set<Function>();
  private exitHandlers = new Set<Function>();
  private stdinWriter: WritableStreamDefaultWriter;

  constructor(private child: Deno.ChildProcess) {
    this.stdinWriter = this.child.stdin.getWriter();
    this.startReading();
    this.monitorExit();
  }

  private async startReading() {
    try {
      let buffer = '';
      for await (const chunk of this.child.stdout) {
        buffer += this.decoder.decode(chunk);
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';  // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.trim()) {
            try {
              const message = JSON.parse(line);
              this.messageHandlers.forEach(handler => handler(message));
            } catch (err) {
              this.errorHandlers.forEach(handler =>
                handler(new Error(`Failed to parse message: ${line}`))
              );
            }
          }
        }
      }
    } catch (err) {
      this.errorHandlers.forEach(handler => handler(err));
    }
  }

  private async monitorExit() {
    const status = await this.child.status;
    this.exitHandlers.forEach(handler => handler(status.code));
  }

  send(message: any): void {
    const json = JSON.stringify(message) + '\n';
    this.stdinWriter.write(this.encoder.encode(json));
  }

  on(event: string, handler: Function): void {
    if (event === 'message') {
      this.messageHandlers.add(handler);
    } else if (event === 'error') {
      this.errorHandlers.add(handler);
    } else if (event === 'exit') {
      this.exitHandlers.add(handler);
    }
  }

  kill(): void {
    this.child.kill();
  }

  get raw() {
    return this.child;
  }
}
```

### Automatic Runtime Detection

```typescript
// src/runtime/detect.ts

/**
 * Detect the current JavaScript runtime
 */
export function detectRuntime(): 'node' | 'bun' | 'deno' {
  // Check for Bun
  if (typeof Bun !== 'undefined') {
    return 'bun';
  }

  // Check for Deno
  if (typeof Deno !== 'undefined') {
    return 'deno';
  }

  // Default to Node.js
  return 'node';
}

/**
 * Get the appropriate runtime adapter
 */
export function getRuntimeAdapter(): RuntimeAdapter {
  const runtime = detectRuntime();

  switch (runtime) {
    case 'bun':
      return new BunAdapter();
    case 'deno':
      return new DenoAdapter();
    case 'node':
    default:
      return new NodeAdapter();
  }
}
```

---

## API Design

### User-Facing API (No Changes)

The API remains identical across all runtimes:

```typescript
// Works on Node.js, Bun, and Deno with no changes!
import { procxy } from 'procxy';
import { Calculator } from './calculator.js';

const calc = await procxy(Calculator);
const result = await calc.add(5, 3);
await calc.$terminate();
```

### Runtime-Specific Configuration (Optional)

For advanced users who need runtime-specific control:

```typescript
interface ProcxyOptions {
  // ... existing options ...

  /**
   * Runtime-specific options
   */
  runtime?: {
    /**
     * Override automatic runtime detection
     */
    force?: 'node' | 'bun' | 'deno';

    /**
     * Deno-specific permissions (only used on Deno)
     */
    denoPermissions?: string[];

    /**
     * Custom executable path
     */
    executable?: string;
  };
}
```

**Example:**
```typescript
// Deno: Customize permissions
const worker = await procxy(Worker, {
  runtime: {
    denoPermissions: ['--allow-read', '--allow-net']
  }
});

// Force specific runtime (useful for testing)
const worker = await procxy(Worker, {
  runtime: {
    force: 'bun'
  }
});
```

---

## Implementation Strategy

### Phase 1: Runtime Abstraction Layer

**Goal:** Create adapter interfaces and Node.js adapter

**Tasks:**
1. Define `RuntimeAdapter` and `ChildHandle` interfaces
2. Implement `NodeAdapter` (wrap existing code)
3. Refactor `procxy()` to use adapter pattern
4. Add runtime detection utilities
5. Test with Node.js to ensure no regressions

**Files to Create:**
- `src/runtime/adapter.ts` - Interface definitions
- `src/runtime/node-adapter.ts` - Node.js implementation
- `src/runtime/detect.ts` - Runtime detection

**Files to Modify:**
- `src/parent/procxy.ts` - Use adapter instead of direct `fork()`
- `src/parent/ipc-client.ts` - Work with `ChildHandle` interface

---

### Phase 2: Bun Support

**Goal:** Add Bun runtime support

**Tasks:**
1. Implement `BunAdapter` using `Bun.spawn()`
2. Create Bun-specific child agent entry point
3. Test IPC communication between Bun processes
4. Add Bun-specific tests
5. Document Bun support in README

**Files to Create:**
- `src/runtime/bun-adapter.ts` - Bun implementation
- `tests/runtime/bun.test.ts` - Bun-specific tests

**Files to Modify:**
- `src/runtime/detect.ts` - Add Bun detection
- `README.md` - Document Bun support

**Challenges:**
- Ensure JSC serialization works correctly
- Handle Bun-specific quirks (if any)
- Test on Bun's latest version

---

### Phase 3: Deno Support (Native)

**Goal:** Add Deno runtime support using native `Deno.Command`

**Tasks:**
1. Implement `DenoAdapter` with JSON-over-stdio protocol
2. Create Deno-specific child agent using stdin/stdout
3. Handle permissions properly
4. Add permission configuration API
5. Test with various permission combinations
6. Document Deno support and permission requirements

**Files to Create:**
- `src/runtime/deno-adapter.ts` - Deno implementation
- `src/child/agent-deno.ts` - Deno child entry point with stdio IPC
- `tests/runtime/deno.test.ts` - Deno-specific tests

**Files to Modify:**
- `src/runtime/detect.ts` - Add Deno detection
- `README.md` - Document Deno support and permissions

**Challenges:**
- Implement reliable line-delimited JSON protocol
- Handle partial message buffering
- Deal with Deno's permission system
- Test module resolution with URLs

---

### Phase 4: Documentation and Examples

**Goal:** Comprehensive documentation for all runtimes

**Tasks:**
1. Add runtime support section to README
2. Create runtime-specific examples
3. Add troubleshooting guides for each runtime
4. Document performance characteristics
5. Create migration guides

---

## Challenges and Trade-offs

### Bun Challenges

1. **Bun-to-Bun Only**
   - Current limitation: IPC only works between Bun processes
   - Cannot mix Bun parent with Node child or vice versa
   - Acceptable trade-off: Users running Bun likely want full Bun stack

2. **JSC vs V8 Serialization**
   - Bun uses JSC (JavaScriptCore) serialization
   - Slightly different from V8's structured clone
   - Need to verify compatibility with all supported types

3. **Rapid Evolution**
   - Bun is evolving quickly
   - APIs may change between versions
   - Need to test across Bun versions regularly

### Deno Challenges

1. **Permissions System**
   - Requires specifying permissions upfront
   - Different apps need different permissions
   - Solution: Provide sensible defaults + customization API

2. **Module Resolution**
   - Deno uses URLs for imports (`https://...`)
   - Different from Node.js file paths
   - Need to handle both URL and file path resolution

3. **JSON-over-stdio Protocol**
   - More complex than native IPC
   - Need careful message framing (line-delimited JSON)
   - Buffering logic for partial messages
   - Higher overhead than binary IPC

4. **Error Handling**
   - stderr needs separate handling
   - Child errors may not be structured
   - Need to parse stderr for debugging

### General Challenges

1. **Testing Matrix**
   - 3 runtimes × multiple versions = many test combinations
   - CI/CD needs to test all runtimes
   - Maintenance burden increases

2. **Bundle Size**
   - Runtime adapters add code
   - Need tree-shaking to avoid including unused adapters
   - Provide runtime-specific builds?

3. **Type Safety**
   - TypeScript types must work across all runtimes
   - Different runtime globals (Bun, Deno, process)
   - Use conditional types and proper ambient declarations

4. **Feature Parity**
   - Some features may not work on all runtimes
   - Document runtime-specific limitations clearly
   - Provide runtime capability detection

---

## Performance Considerations

### Expected Performance Characteristics

| Runtime | Startup Time | IPC Overhead | Memory Usage | Best For |
|---------|--------------|--------------|--------------|----------|
| Node.js | ~50ms | Low (binary) | Medium | Production workloads |
| Bun | **~10ms** | Low (binary) | **Low** | Fast iteration, development |
| Deno | ~40ms | **Higher (JSON)** | Medium | Security-critical apps |

### Optimization Strategies

1. **Bun**: Leverage fast startup for high-frequency worker creation
2. **Deno**: Use permission caching to avoid repeated checks
3. **All**: Implement connection pooling to amortize startup costs

---

## Success Criteria

### Minimum Viable Product (MVP)

- ✅ Same API works on Node.js, Bun, and Deno
- ✅ Automatic runtime detection
- ✅ Basic IPC communication on all runtimes
- ✅ Core features work: method calls, properties, events
- ✅ Documentation for each runtime

### Full Feature Parity

- ✅ Advanced serialization on Bun (JSC) and Node (V8)
- ✅ Callback support across all runtimes
- ✅ Error handling with full stack traces
- ✅ Disposable protocol (`await using`) support
- ✅ Runtime-specific optimizations

---

## References

### Bun Documentation
- [Bun IPC Guide](https://bun.sh/guides/process/ipc)
- [Bun.spawn API Reference](https://bun.com/reference/bun/spawn)
- [Node.js child_process compatibility](https://bun.com/reference/node/child_process/fork)

### Deno Documentation
- [Deno.Command API](https://docs.deno.com/api/deno/~/Deno.Command)
- [Node.js child_process compatibility](https://docs.deno.com/api/node/child_process/)
- [IPC Discussion (Issue #2585)](https://github.com/denoland/deno/issues/2585)

### Procxy Internals
- Current implementation: `src/parent/procxy.ts`
- IPC protocol: `src/shared/protocol.ts`
- Child agent: `src/child/agent.ts`

---

## Next Steps

1. **Prototype**: Implement runtime abstraction layer (Phase 1)
2. **Bun MVP**: Get basic Bun support working (Phase 2)
3. **Validate**: Test with real-world use cases
4. **Deno**: Implement Deno support if Bun MVP successful (Phase 3)
5. **Document**: Comprehensive docs and examples (Phase 4)
6. **Release**: Publish as minor version with runtime support

---

**End of Specification**
