# Getting Started

> **⚠️ Pre-1.0 software** — APIs are subject to change between minor versions. Pin to exact versions in production.

procxy lets you run class instances in isolated child processes while interacting with them as if they were local objects. All method calls become async and are transparently forwarded over IPC with full TypeScript support.

## Install

```bash
npm install procxy
```

## Quick example

```typescript
import { procxy } from 'procxy';
import { Calculator } from './calculator.js';

// Automatic module path detection (recommended)
const calc = await procxy(Calculator);

const sum = await calc.add(5, 3); // 8
await calc.$terminate();
```

## Next steps

- [Installation](./installation.md)
- [Usage](./usage.md)
- [API Reference](../api/)
