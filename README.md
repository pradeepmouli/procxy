# procxy

**procxy** is a library which provides an ergonomic way to access an object instantiated in a Node.js child process by way of a proxy.

It aims to make Inter-Process Communication (IPC) as simple and intuitive as calling methods on a local object, while maintaining full type safety with TypeScript.

## Constitution

For a detailed overview of the project's purpose, core principles, and architecture, please refer to the [Constitution of Procxy](.specify/memory/constitution.md).

## Specification

For a detailed technical specification of the API and internal design, please refer to the [Procxy Core Library Specification](specs/001-procxy-core-library/spec.md).

## Features

- **Ergonomic API**: Interact with remote objects using standard method calls.
- **Type Safe**: Full TypeScript support for arguments and return values.
- **Transparent**: Proxies behave like the real objects they represent.
- **Asynchronous**: Seamlessly handles the asynchronous nature of IPC.

## Installation

```bash
pnpm add procxy
```

## Usage (Conceptual)

```typescript
// calculator.ts - Define your class
export class Calculator {
  add(a: number, b: number): number {
    return a + b;
  }

  multiply(a: number, b: number): number {
    return a * b;
  }
}

// main.ts - Use it in parent process
import { procxy } from 'procxy';
import { Calculator } from './calculator';

async function main() {
  // Create a proxy that runs Calculator in a child process
  const calculator = await procxy(Calculator);

  // Call methods as if they were local (but they return Promises)
  const sum = await calculator.add(2, 3);
  console.log(sum); // 5

  const product = await calculator.multiply(4, 5);
  console.log(product); // 20

  // Clean up when done
  calculator.$terminate();
}
```

## Development Features

This repository is configured with modern tooling and best practices:

- ✅ TypeScript with strict type checking
- ✅ Modern ES2022+ syntax
- ✅ pnpm package management
- ✅ Vitest for testing
- ✅ oxlint for linting
- ✅ oxfmt for formatting
- ✅ Decorator support
- ✅ Environment variable management with dotenvx
- ✅ Structured logging with pino
- ✅ Runtime validation with Zod
- ✅ Changesets for version management
- ✅ Pre-commit hooks with Husky
- ✅ GitHub Actions CI/CD
- ✅ Dependabot for dependency updates
- ✅ AI agent instructions (AGENTS.md)
- ✅ MCP server configuration for Context7

## Scripts

| Script               | Description                             |
| -------------------- | --------------------------------------- |
| `pnpm dev`           | Run in development mode with hot reload |
| `pnpm build`         | Compile TypeScript to JavaScript        |
| `pnpm start`         | Run the compiled application            |
| `pnpm test`          | Run tests with Vitest                   |
| `pnpm test:coverage` | Run tests with coverage report          |
| `pnpm lint`          | Lint code with oxlint                   |
| `pnpm format`        | Format code with oxfmt                  |
| `pnpm format:check`  | Check code formatting                   |
| `pnpm type-check`    | Type check without building             |
| `pnpm clean`         | Remove build artifacts                  |
| `pnpm changeset`     | Create a new changeset                  |
| `pnpm version`       | Version packages using changesets       |
| `pnpm release`       | Build and publish to npm                |

## Contributing

1. Follow the coding standards in [AGENTS.md](AGENTS.md)
2. Write tests for new features
3. Use conventional commits
4. Ensure all tests pass before submitting PR

## License

MIT
