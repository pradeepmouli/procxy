# Migration Guide: JSON to Advanced Serialization

This guide helps you migrate from JSON serialization (default) to advanced serialization mode in procxy.

## Table of Contents

- [When to Migrate](#when-to-migrate)
- [Step-by-Step Migration](#step-by-step-migration)
- [API Changes](#api-changes)
- [Type Changes](#type-changes)
- [Common Patterns](#common-patterns)
- [Troubleshooting](#troubleshooting)

## When to Migrate

Consider migrating to advanced serialization if you need to:

- ✅ Transfer `Buffer` objects between processes
- ✅ Use `Map` and `Set` collections in method parameters/returns
- ✅ Work with `BigInt` values
- ✅ Preserve full `Error` objects with custom properties
- ✅ Handle `TypedArray` instances (Uint8Array, Float32Array, etc.)
- ✅ Pass network sockets between processes (handle passing)
- ✅ Transfer `Date`, `RegExp`, or other built-in objects

**Do NOT migrate if:**
- ❌ You need to inspect serialized messages (advanced mode is binary)
- ❌ You're using older Node.js versions (< 14.x)
- ❌ Your data is purely JSON-compatible (no performance benefit)

## Step-by-Step Migration

### Step 1: Update procxy() Call

**Before (JSON mode - default):**
```typescript
import { procxy } from 'procxy';

const worker = await procxy(Worker, './worker.js');
```

**After (Advanced mode):**
```typescript
import { procxy } from 'procxy';

const worker = await procxy<Worker, 'advanced'>(
  Worker,
  { serialization: 'advanced' }
);
```

### Step 2: Update Method Signatures

**Before (JSON mode):**
```typescript
class ImageProcessor {
  processImage(data: string): string {
    // Base64-encoded image data
    const buffer = Buffer.from(data, 'base64');
    // ... process buffer
    return buffer.toString('base64');
  }
}
```

**After (Advanced mode):**
```typescript
class ImageProcessor {
  processImage(data: Buffer): Buffer {
    // Direct Buffer usage - no encoding needed!
    // ... process buffer
    return buffer;
  }
}
```

### Step 3: Update Collections

**Before (JSON mode):**
```typescript
class DataStore {
  getUserPreferences(userId: string): Record<string, any> {
    const map = this.internalMap.get(userId);
    return Object.fromEntries(map); // Convert to plain object
  }

  getUniqueIds(): string[] {
    return Array.from(this.idsSet); // Convert to array
  }
}
```

**After (Advanced mode):**
```typescript
class DataStore {
  getUserPreferences(userId: string): Map<string, any> {
    return this.internalMap.get(userId); // Return Map directly!
  }

  getUniqueIds(): Set<string> {
    return this.idsSet; // Return Set directly!
  }
}
```

### Step 4: Update BigInt Usage

**Before (JSON mode):**
```typescript
class Calculator {
  factorial(n: number): string {
    // Return as string because JSON can't handle BigInt
    return this.calculateFactorial(BigInt(n)).toString();
  }
}

// Usage
const result = await calculator.factorial(100);
const bigIntValue = BigInt(result); // Parse back to BigInt
```

**After (Advanced mode):**
```typescript
class Calculator {
  factorial(n: bigint): bigint {
    return this.calculateFactorial(n); // Return BigInt directly!
  }
}

// Usage
const result = await calculator.factorial(100n); // Native BigInt!
```

### Step 5: Update Error Handling

**Before (JSON mode):**
```typescript
class ValidationService {
  validate(data: any): void {
    if (!data.email) {
      // Custom properties will be lost in JSON serialization
      const error: any = new Error('Email required');
      error.code = 'VALIDATION_ERROR';
      error.field = 'email';
      throw error;
    }
  }
}

// Caller side
try {
  await service.validate(data);
} catch (error: any) {
  console.log(error.code);  // undefined - lost in JSON serialization!
  console.log(error.field); // undefined - lost in JSON serialization!
}
```

**After (Advanced mode):**
```typescript
class ValidationError extends Error {
  constructor(
    message: string,
    public code: string,
    public field: string
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

class ValidationService {
  validate(data: any): void {
    if (!data.email) {
      throw new ValidationError('Email required', 'VALIDATION_ERROR', 'email');
    }
  }
}

// Caller side
try {
  await service.validate(data);
} catch (error) {
  if (error instanceof ValidationError) {
    console.log(error.code);  // 'VALIDATION_ERROR' - preserved!
    console.log(error.field); // 'email' - preserved!
  }
}
```

## API Changes

### Options Object

The `serialization` option is now available:

```typescript
interface ProcxyOptions {
  serialization?: 'json' | 'advanced';  // NEW
  modulePath?: string;                  // NEW - can be in options
  supportHandles?: boolean;             // NEW - for socket passing
  timeout?: number;
  retries?: number;
  env?: Record<string, string>;
  cwd?: string;
  args?: Jsonifiable[];
}
```

### Type Parameters

When using advanced mode, specify the mode as a type parameter:

```typescript
// Explicit mode parameter
const worker = await procxy<Worker, 'advanced'>(
  Worker,
  { serialization: 'advanced' }
);

// Without mode parameter (defaults to 'json')
const worker = await procxy(Worker); // Procxy<Worker, 'json'>
```

## Type Changes

### Return Type Variations

The mode parameter affects which types are allowed:

```typescript
// JSON mode - only Jsonifiable types
type Procxy<T, 'json'> = {
  [K in keyof T]: T[K] extends (...args: infer P) => infer R
    ? (...args: P) => Promise<R> // R must be Jsonifiable
    : never;
}

// Advanced mode - V8Serializable types
type Procxy<T, 'advanced'> = {
  [K in keyof T]: T[K] extends (...args: infer P) => infer R
    ? (...args: P) => Promise<R> // R can be V8Serializable
    : never;
}
```

### Type Guards

Use type predicates for proper type narrowing:

```typescript
import type { Procxy, V8Serializable } from 'procxy';

function isAdvancedMode<T>(
  proxy: Procxy<T, 'json'> | Procxy<T, 'advanced'>
): proxy is Procxy<T, 'advanced'> {
  // Runtime check would go here
  return true;
}
```

## Common Patterns

### Pattern 1: Buffer-Heavy Operations

**Before:**
```typescript
class ImageService {
  async processImage(base64: string): Promise<string> {
    const buffer = Buffer.from(base64, 'base64');
    const processed = await this.transform(buffer);
    return processed.toString('base64');
  }
}

const service = await procxy(ImageService, './service.js');
const result = await service.processImage(imageBase64);
const buffer = Buffer.from(result, 'base64');
```

**After:**
```typescript
class ImageService {
  async processImage(buffer: Buffer): Promise<Buffer> {
    return this.transform(buffer);
  }
}

const service = await procxy<ImageService, 'advanced'>(
  ImageService,
  { serialization: 'advanced' }
);
const result = await service.processImage(imageBuffer);
// result is already a Buffer!
```

### Pattern 2: Collection Processing

**Before:**
```typescript
class CacheService {
  async getMultiple(keys: string[]): Promise<Record<string, any>> {
    const map = new Map();
    // ... populate map
    return Object.fromEntries(map);
  }
}

const cache = await procxy(CacheService, './cache.js');
const results = await cache.getMultiple(['key1', 'key2']);
const map = new Map(Object.entries(results));
```

**After:**
```typescript
class CacheService {
  async getMultiple(keys: string[]): Promise<Map<string, any>> {
    const map = new Map();
    // ... populate map
    return map;
  }
}

const cache = await procxy<CacheService, 'advanced'>(
  CacheService,
  { serialization: 'advanced' }
);
const results = await cache.getMultiple(['key1', 'key2']);
// results is already a Map!
```

### Pattern 3: Large Number Calculations

**Before:**
```typescript
class MathService {
  async factorial(n: number): Promise<string> {
    return this.calcFactorial(BigInt(n)).toString();
  }
}

const math = await procxy(MathService, './math.js');
const result = await math.factorial(100);
const value = BigInt(result);
console.log(value);
```

**After:**
```typescript
class MathService {
  async factorial(n: bigint): Promise<bigint> {
    return this.calcFactorial(n);
  }
}

const math = await procxy<MathService, 'advanced'>(
  MathService,
  { serialization: 'advanced' }
);
const result = await math.factorial(100n);
console.log(result); // Already BigInt!
```

## Troubleshooting

### Issue: Type Errors After Migration

**Problem:**
```typescript
const worker = await procxy<Worker, 'advanced'>(Worker, { serialization: 'advanced' });
// Type error: Buffer is not assignable to type 'Jsonifiable'
```

**Solution:**
Ensure the mode type parameter matches the serialization option:
```typescript
// ✅ Correct - mode matches option
const worker = await procxy<Worker, 'advanced'>(
  Worker,
  { serialization: 'advanced' }
);

// ❌ Wrong - mismatch
const worker = await procxy<Worker, 'json'>(
  Worker,
  { serialization: 'advanced' } // TypeScript error!
);
```

### Issue: "Function not supported" Error

**Problem:**
```typescript
class Service {
  processWithCallback(data: string, callback: (result: string) => void) {
    callback(data.toUpperCase());
  }
}
```

**Solution:**
Callbacks don't work across processes. Use promises instead:
```typescript
class Service {
  async process(data: string): Promise<string> {
    return data.toUpperCase();
  }
}
```

### Issue: Handle Passing Not Working

**Problem:**
```typescript
const service = await procxy<Service, 'advanced'>(
  Service,
  { serialization: 'advanced' }
);
await service.$sendHandle(socket, 'socket-1'); // Error!
```

**Solution:**
Enable `supportHandles` option:
```typescript
const service = await procxy<Service, 'advanced'>(
  Service,
  {
    serialization: 'advanced',
    supportHandles: true  // Required for handle passing
  }
);
```

### Issue: Performance Regression

**Problem:**
After switching to advanced mode, performance is worse for simple data.

**Solution:**
Advanced mode has overhead for simple JSON-like data. Only use it when you need V8-specific types:

```typescript
// ❌ Overkill for simple strings
const simple = await procxy<Simple, 'advanced'>(
  Simple,
  { serialization: 'advanced' }
);

// ✅ Use JSON mode for simple data
const simple = await procxy(Simple);
```

## Next Steps

- Review [Examples](./README.md) for real-world usage patterns
- Check [Benchmarks](../../benchmark/serialization-modes.ts) for performance comparisons
- Read the main [README](../../README.md) for complete API documentation

## Getting Help

If you encounter issues during migration:

1. Check [Common Issues](#troubleshooting) above
2. Review the [type definitions](../../src/types/procxy.ts)
3. Open an issue on [GitHub](https://github.com/pradeepmouli/procxy/issues)
