# Module Path Detection Research

**Feature**: 001-procxy-core-library  
**Research Date**: 2025-12-27  
**Topic**: Feasibility of automatic module path detection from constructor

## Problem Statement

When a user calls `procxy(Calculator, arg1, arg2)`, the library needs to determine:
1. What module exports the `Calculator` class
2. The absolute file path to that module
3. The export name within that module

## Research Findings

### Available Approaches

#### 1. **Error Stack Trace Inspection** ⭐ Recommended
**How it works**: Create an Error, capture stack trace, parse to find caller location

```typescript
function getCallerModulePath(): string {
  const err = new Error();
  const stack = err.stack?.split('\n');
  // Stack frame 0: Error
  // Stack frame 1: getCallerModulePath
  // Stack frame 2: procxy
  // Stack frame 3: user's call site <-- we want this
  const callerFrame = stack?.[3];
  
  // Parse: "at Object.<anonymous> (/path/to/user/file.ts:10:20)"
  const match = callerFrame?.match(/\((.+):(\d+):(\d+)\)/);
  return match?.[1]; // /path/to/user/file.ts
}
```

**Pros**:
- Works in both ESM and CommonJS
- No dependencies on module cache
- Reliable across Node versions
- Can determine exact call site

**Cons**:
- Requires parsing string output (format may vary)
- Assumes specific stack depth (could break with decorators/wrappers)
- Bundlers/transpilers may affect stack traces

**Feasibility**: ✅ **High** - This is the most reliable approach

---

#### 2. **Module Cache Inspection** (CommonJS only)
**How it works**: Inspect `require.cache` or `module.parent`

```typescript
// CommonJS only
function getModulePathFromCache(constructor: Function): string | undefined {
  // Iterate through require.cache
  for (const [path, mod] of Object.entries(require.cache)) {
    // Check if this module exports our constructor
    if (mod.exports === constructor || 
        mod.exports?.default === constructor ||
        Object.values(mod.exports).includes(constructor)) {
      return path;
    }
  }
}
```

**Pros**:
- Direct access to module metadata
- No parsing required

**Cons**:
- ❌ Only works in CommonJS (not ESM)
- May not work with dynamic imports
- Constructor may not be the direct export

**Feasibility**: ⚠️ **Medium** - Limited to CommonJS, not future-proof

---

#### 3. **import.meta.url + createRequire** (ESM)
**How it works**: Use ESM import.meta.url as base for resolution

```typescript
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

// In the user's code (not feasible for library)
const require = createRequire(import.meta.url);
const calculatorPath = require.resolve('./calculator.js');
```

**Pros**:
- Official Node.js API
- Works with ESM

**Cons**:
- ❌ Requires user's `import.meta.url` (not accessible from library)
- Doesn't help us discover the path automatically

**Feasibility**: ❌ **Low** - Can't access caller's import.meta.url

---

#### 4. **Explicit Path Requirement** (Fallback)
**How it works**: Require user to provide module path explicitly

```typescript
await procxy(Calculator, { 
  modulePath: './calculator.js' 
}, arg1, arg2);
```

**Pros**:
- 100% reliable
- No magic, explicit
- Works in all scenarios

**Cons**:
- Less ergonomic (more boilerplate)
- User must know their own module structure

**Feasibility**: ✅ **High** - Always works as fallback

---

## Recommended Implementation Strategy

### Phase 1: Auto-detection via Stack Traces
1. Capture Error stack on `procxy()` call
2. Parse stack to find caller file path
3. Extract module path from stack frame
4. Handle both absolute and relative paths
5. Support both ESM (`file:///path`) and CommonJS (`/path`)

### Phase 2: Explicit Override
1. Check if `options.modulePath` is provided
2. If provided, skip auto-detection
3. Validate explicit path exists
4. Use explicit path for child import

### Phase 3: Class Name Detection
1. Use `constructor.name` for class name
2. Validate class name matches export
3. Handle default exports vs named exports

## Implementation Example

```typescript
// module-resolver.ts
export function resolveConstructorModule(constructor: Function): {
  modulePath: string;
  className: string;
} {
  // Get class name
  const className = constructor.name;
  if (!className || className === 'Function') {
    throw new Error('Constructor must be a named class');
  }

  // Capture stack trace
  const err = new Error();
  Error.captureStackTrace(err, resolveConstructorModule);
  const stack = err.stack?.split('\n');
  
  // Find the frame that called procxy()
  // Typically stack[2] or stack[3] depending on call depth
  const callerFrame = stack?.find(line => 
    !line.includes('node_modules/procxy') &&
    !line.includes('module-resolver') &&
    line.includes('at ')
  );

  if (!callerFrame) {
    throw new Error('Could not determine caller module. Please provide modulePath explicitly.');
  }

  // Parse file path from stack frame
  // Format: "at Object.<anonymous> (/path/to/file.ts:10:20)"
  // or: "at file:///path/to/file.ts:10:20"
  const pathMatch = callerFrame.match(/\((.+?):\d+:\d+\)|at\s+(.+?):\d+:\d+/);
  const filePath = pathMatch?.[1] || pathMatch?.[2];

  if (!filePath) {
    throw new Error('Could not extract file path from stack trace');
  }

  // Convert file:// URLs to paths for ESM
  let modulePath = filePath;
  if (modulePath.startsWith('file://')) {
    modulePath = fileURLToPath(new URL(modulePath));
  }

  return { modulePath, className };
}
```

## Edge Cases to Handle

1. **Bundled code**: Stack traces may point to bundle, not source
   - **Solution**: Allow explicit modulePath override
   
2. **Transpiled code**: TypeScript → JavaScript path mismatch
   - **Solution**: Source maps (future enhancement)
   
3. **Anonymous classes**: `class extends Foo {}`
   - **Solution**: Throw error, require named class
   
4. **Decorated constructors**: Decorators add stack frames
   - **Solution**: Skip frames from known decorator patterns
   
5. **REPL/eval**: No file path available
   - **Solution**: Require explicit modulePath

## Conclusion

**Verdict**: ✅ **Auto-detection is feasible with limitations**

**Recommended Approach**:
1. **Primary**: Stack trace inspection (covers 90% of cases)
2. **Fallback**: Explicit `modulePath` option (covers remaining 10%)
3. **Future**: Source map support for transpiled code

This provides the ergonomic API (`procxy(Calculator, args)`) while maintaining reliability through explicit override when needed.

## Testing Strategy

1. Unit tests with simple classes
2. Integration tests with ESM and CommonJS
3. Test with TypeScript transpilation
4. Test with decorators
5. Test explicit modulePath override
6. Document when auto-detection fails
