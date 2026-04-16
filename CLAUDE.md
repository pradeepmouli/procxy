# procxy Development Guidelines

## Project Overview

Transparent and type-safe process-based proxy for class instances. Run class instances in isolated child processes while interacting with them as if they were local objects — all method calls become async and are forwarded over IPC.

## Tech Stack

- TypeScript 5, Node.js ≥20
- Vitest (test runner), oxlint (linter), oxfmt (formatter)
- pnpm workspaces, tsup/tsx (build/dev), changesets (releases)

## Project Structure

```text
src/          # Core proxy implementation
tests/        # Vitest test suite
apps/         # Demo/example applications
specs/        # Specification documents
benchmark/    # Performance benchmarks
docs/         # VitePress documentation
```

## Commands

```bash
pnpm install        # Install dependencies
pnpm test           # Run tests
pnpm run type-check # TypeScript strict mode
pnpm run build      # Build
pnpm run lint       # oxlint
pnpm run format     # oxfmt
```

## Code Style

- TypeScript strict mode, no `any`
- oxlint for linting, oxfmt for formatting
- Conventional commits

## Key Patterns

- **Process proxy pattern** — `procxy(Class, modulePath)` spawns a child process and returns a Proxy that forwards method calls over IPC
- **Disposable protocol** — `$terminate()` / `Symbol.asyncDispose` for automatic cleanup
- **EventEmitter forwarding** — transparent event subscription across process boundary
- **Error propagation** — serialized errors with full stack traces reconstructed on parent side

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
