---
layout: home
hero:
  name: procxy
  text: Type-safe process-based proxy for Node.js
  tagline: Run class instances in isolated child processes while interacting with them as if they were local objects. All method calls become async and are transparently forwarded over IPC with full TypeScript support.
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: View on GitHub
      link: https://github.com/pradeepmouli/procxy
features:
  - title: Type-Safe
    details: Full TypeScript support with IntelliSense autocomplete across the IPC boundary.
  - title: Automatic Module Resolution
    details: Zero-config import path detection from your source code — just pass the class.
  - title: Fast
    details: Less than 10ms overhead per method call.
  - title: Events & Callbacks
    details: Transparent EventEmitter forwarding and bidirectional callback support.
  - title: Lifecycle Management
    details: Automatic cleanup with disposable protocol (`using` / `await using`).
  - title: Zero Dependencies
    details: Minimal bundle size under 50KB with no runtime dependencies.
---
