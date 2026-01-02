# Data Model

## Entities

- ChildToParentMessage
  - Fields: `type: 'response' | 'event' | 'error' | 'dispose'`, payload varies by type
  - Relationships: Consumed by parent IPC client to drive lifecycle and responses
  - Validation: `type` must be one of the allowed literals; `dispose` carries no payload

- ParentLifecycle
  - States: `active`, `terminating`, `terminated`
  - Transitions:
    - `active` -> `terminating` when dispose message received or parent terminate invoked
    - `terminating` -> `terminated` after child process exit and cleanup
  - Guards: Termination path is idempotent; repeated dispose/terminate calls no-op once terminating/terminated

## Derived Behaviors

- Child-initiated dispose is a one-way signal; parent owns process exit and cleanup.
- Existing termination emits `terminated` event; child-initiated dispose must follow the same path to keep contract stable.
- No new persistent data or external storage is introduced.
