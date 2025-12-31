# Advanced Serialization Examples

This directory contains examples demonstrating the advanced serialization features of Procxy, including V8 structured clone support and handle passing.

## Overview

Procxy supports two serialization modes:

- **JSON mode (default)**: Uses `JSON.stringify`/`JSON.parse`. Fast and compatible with simple types.
- **Advanced mode**: Uses V8 structured clone algorithm. Supports complex types like Buffer, Map, Set, BigInt, Date, RegExp, and Error.

## Examples

### Basic V8 Types

- [`buffer-processing.ts`](./buffer-processing.ts) - Working with Buffer arguments and return values
- [`bigint-calculations.ts`](./bigint-calculations.ts) - Large number calculations with BigInt
- [`collection-processing.ts`](./collection-processing.ts) - Using Map and Set collections
- [`error-preservation.ts`](./error-preservation.ts) - Full Error object preservation

### Handle Passing

- [`socket-transfer.ts`](./socket-transfer.ts) - Transferring network sockets to child processes

### Migration

- [`migration-guide.md`](./migration-guide.md) - Step-by-step guide to migrate from JSON to advanced mode

## Running Examples

Each example is a standalone TypeScript file that can be run with:

```bash
# Install dependencies first
pnpm install

# Run an example
pnpm tsx examples/advanced-serialization/buffer-processing.ts
```

## Quick Start

### Using Advanced Mode

```typescript
import { procxy } from 'procxy';

class BinaryProcessor {
  processBuffer(data: Buffer): Buffer {
    // Transform binary data
    return Buffer.from(data).reverse();
  }
}

// Enable advanced serialization mode
await using processor = await procxy(BinaryProcessor, './processor.js', {
  serialization: 'advanced'
});

const input = Buffer.from('hello');
const result = await processor.processBuffer(input); // ✅ Works!
```

### When to Use Advanced Mode

Use advanced serialization when you need:
- Binary data processing (Buffer, TypedArray)
- Collections with proper fidelity (Map, Set)
- Large number calculations (BigInt)
- Full error object preservation
- Date/RegExp object instances (not just strings)

Use JSON mode when:
- Working with simple data structures
- Maximum performance is critical
- All data is JSON-serializable

## Performance Considerations

Advanced mode is slightly slower than JSON mode for simple objects, but enables use cases that would otherwise require manual conversion. For binary data and collections, advanced mode is significantly more efficient than converting to/from JSON-compatible formats.

See [`../../benchmark/serialization-modes.ts`](../../benchmark/serialization-modes.ts) for detailed benchmarks.
