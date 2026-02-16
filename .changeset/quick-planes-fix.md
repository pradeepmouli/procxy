---
'procxy': patch
---

Fix proxy reuse stability and Bun compatibility messaging:

- Fix dedup cache liveness checks to use `$process` state instead of probing reserved proxy internals.
- Make `$sendHandle()` fail fast on Bun with a clear runtime error instead of waiting for an IPC timeout.
- Document that handle passing requires the Node.js runtime.
