/**
 * Public exports for Procxy library.
 * Includes the main procxy function and all public types.
 */

// Main function (will be implemented in Phase 3 - US1)
// export { procxy } from './parent/procxy.js';

// Types
export type { Procxy } from './types/procxy.js';
export type { ProcxyOptions } from './types/options.js';

// Errors (public API for users to catch specific errors)
export {
  ProcxyError,
  TimeoutError,
  ModuleResolutionError,
  ChildCrashedError,
  SerializationError,
  OptionsValidationError,
} from './shared/errors.js';

// Protocol types (for advanced use cases)
export type {
  InitMessage,
  Request,
  Response,
  ErrorInfo,
  EventMessage,
  ParentToChildMessage,
  ChildToParentMessage,
} from './shared/protocol.js';
