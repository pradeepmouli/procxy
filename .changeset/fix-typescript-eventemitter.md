---
"procxy": patch
---

Fix module resolution and EventEmitter support in subprocess mode

- **Module Resolution**: Fixed `.ts`/`.js` extension resolution to support both TypeScript source files and compiled JavaScript output. The resolver now checks for both extensions and falls back appropriately, enabling procxy to work in both development (tsx) and production (compiled) environments.

- **EventEmitter Support**: Enhanced child proxy to properly handle classes extending EventEmitter by filtering out function assignments during property synchronization. This prevents "could not be cloned" errors when EventEmitter's internal event handling setup tries to assign functions across IPC boundaries.

These fixes enable classes that extend EventEmitter to run in subprocess mode and ensure compatibility with various execution environments.
