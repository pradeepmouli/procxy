# Usage

## Basic

```typescript
import { procxy } from 'procxy';
import { Calculator } from './calculator.js';

// Automatic module path detection
const calc = await procxy(Calculator);

const sum = await calc.add(5, 3); // 8
const product = await calc.multiply(4, 7); // 28

await calc.$terminate();
```

## Disposables (recommended)

```typescript
import { procxy } from 'procxy';
import { Calculator } from './calculator.js';

await using calc = await procxy(Calculator);
const result = await calc.add(5, 3);
// Automatically terminated when scope exits
```

## Constructor arguments

```typescript
import { procxy } from 'procxy';
import { Worker } from './worker.js';

const worker = await procxy(
  Worker,
  undefined,  // options (or omit)
  'MyWorker', // name
  4           // threads
);

const result = await worker.process(['hello', 'world']);
await worker.$terminate();
```

## More

See the [API Reference](../api/) for the full surface: `procxy()`, options, events, properties, callbacks, and lifecycle management.
