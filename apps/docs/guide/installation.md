# Installation

## Prerequisites

- Node.js **20 or later**
- TypeScript **5.0+** (if using TypeScript)

## Install

```bash
npm install procxy
```

```bash
pnpm add procxy
```

```bash
yarn add procxy
```

procxy has **zero runtime dependencies**.

## Verify

```typescript
import { procxy } from 'procxy';

class Greeter {
  hello(name: string) {
    return `Hello, ${name}!`;
  }
}

const g = await procxy(Greeter);
console.log(await g.hello('world'));
await g.$terminate();
```

Run with `node --experimental-strip-types` (Node 22+) or via `tsx`/`ts-node`.
