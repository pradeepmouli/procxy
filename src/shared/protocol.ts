import type { Jsonifiable } from 'type-fest';
import type { SerializationMode } from '../types/options.js';

/**
 * IPC message protocol types for Procxy parent-child communication.
 * Payloads use either JSON serialization or V8 structured clone based on serialization mode.
 */

/**
 * Initialization message sent from parent to child on startup.
 * Contains module path, class name, constructor arguments, and serialization mode.
 */
export interface InitMessage {
  /** Discriminant: always `'INIT'` */
  type: 'INIT';
  /** Absolute path to the module file to `import()` in the child process */
  modulePath: string;
  /** Name of the exported class to instantiate in the child process */
  className: string;
  /** Positional constructor arguments forwarded verbatim to `new ClassName(...args)` */
  constructorArgs: [...Jsonifiable[]];
  /** Serialization algorithm to use for subsequent IPC messages; defaults to `'json'` */
  serialization?: SerializationMode;
}

/**
 * Method invocation request sent from parent to child.
 * Includes unique ID for request/response correlation.
 */
export interface Request {
  /** UUID v4 that pairs this request with its {@link Response} */
  id: string;
  /** Discriminant: always `'CALL'` (only CALL is supported in v1) */
  type: 'CALL';
  /** Name of the method to invoke on the remote class instance */
  prop: string;
  /** Positional arguments forwarded to the method call */
  args: [...Jsonifiable[]];
}

/**
 * Disposal request sent from parent to child before termination.
 * Triggers cleanup of the remote object if it implements disposable protocol.
 */
export interface DisposeRequest {
  type: 'DISPOSE';
}

/**
 * Event subscription message sent from parent to child.
 * Tells the child to start forwarding a specific event.
 */
export interface EventSubscribe {
  type: 'EVENT_SUBSCRIBE';
  eventName: string;
}

/**
 * Event unsubscription message sent from parent to child.
 * Tells the child to stop forwarding a specific event.
 */
export interface EventUnsubscribe {
  type: 'EVENT_UNSUBSCRIBE';
  eventName: string;
}

/** * Callback invocation request sent from child to parent.
 * Used when child needs to invoke a callback function provided by parent.
 */
export interface CallbackInvoke {
  id: string; // UUID for correlation
  type: 'CALLBACK_INVOKE';
  callbackId: string; // ID of the callback to invoke
  args: [...Jsonifiable[]]; // Arguments to pass to callback
}

/**
 * Callback invocation result sent from parent to child.
 */
export interface CallbackResult {
  id: string; // UUID matching CallbackInvoke
  type: 'CALLBACK_RESULT';
  value: Jsonifiable; // Return value from callback
}

/**
 * Callback invocation error sent from parent to child.
 */
export interface CallbackError {
  id: string; // UUID matching CallbackInvoke
  type: 'CALLBACK_ERROR';
  error: ErrorInfo; // Error from callback
}

/**
 * Property get request sent from child to parent.
 * Used to retrieve property values from parent's backing store.
 */
export interface PropertyGet {
  id: string;
  type: 'PROPERTY_GET';
  prop: string; // Property name
}

/**
 * Property get result sent from parent to child.
 * Contains the property value from parent's backing store.
 */
export interface PropertyResult {
  id: string;
  type: 'PROPERTY_RESULT';
  value: Jsonifiable; // Property value
}

/**
 * Property set request sent from child to parent.
 * Updates property value in parent's backing store.
 */
export interface PropertySet {
  type: 'PROPERTY_SET';
  prop: string; // Property name
  value: Jsonifiable; // New value
}

/** * Disposal response sent from child to parent after cleanup completes.
 */
export interface DisposeResponse {
  type: 'DISPOSE_COMPLETE';
  error?: ErrorInfo; // Error if disposal failed
}

/**
 * Method invocation response sent from child to parent.
 * Either contains return value (RESULT) or error information (ERROR).
 */
export interface Response {
  /** UUID that matches the originating {@link Request.id} */
  id: string;
  /** `'RESULT'` on success, `'ERROR'` on thrown exception */
  type: 'RESULT' | 'ERROR';
  /** Serialized return value; present only when `type === 'RESULT'` */
  value?: Jsonifiable;
  /** Serialized error details; present only when `type === 'ERROR'` */
  error?: ErrorInfo;
}

/**
 * Error information serialized in Response messages.
 * Preserves error message, stack trace, name, and optional code.
 */
export interface ErrorInfo {
  /** Human-readable error description, copied from `Error.message` */
  message: string;
  /** Full stack trace captured in the child process; absent for non-Error throws */
  stack?: string;
  /** Error class name (e.g., `'TypeError'`, `'RangeError'`), copied from `Error.name` */
  name: string;
  /** Optional error code (e.g., `'ENOENT'`, `'EACCES'`) for Node.js system errors */
  code?: string;
}

/**
 * Event message sent from child to parent for EventEmitter events.
 * Forwards events emitted in child to listeners in parent.
 */
export interface EventMessage {
  /** Discriminant: always `'EVENT'` */
  type: 'EVENT';
  /** Name of the EventEmitter event that was emitted in the child */
  eventName: string;
  /** Positional arguments from the `emit(eventName, ...args)` call */
  args: [...Jsonifiable[]];
}

/**
 * Initialization success message sent from child to parent after instance is created.
 */
export interface InitSuccess {
  type: 'INIT_SUCCESS';
}

/**
 * Initial properties message sent from child to parent after construction.
 * Contains all procxyable properties set during construction (bulk initialization).
 * This is separate from PROPERTY_SET which is used for subsequent runtime updates.
 */
export interface InitProperties {
  type: 'INIT_PROPERTIES';
  properties: Record<string, Jsonifiable>; // Property name -> value map
}

/**
 * Initialization failure message sent from child to parent when instantiation fails.
 */
export interface InitFailure {
  type: 'INIT_FAILURE';
  error: ErrorInfo;
}

/**
 * Handle transmission message sent from parent to child.
 * Notifies child that a handle (socket, server, file descriptor) is being sent.
 * The actual handle is passed separately via Node.js child.send(message, handle).
 */
export interface HandleMessage {
  /** Discriminant: always `'HANDLE'` */
  type: 'HANDLE';
  /** Unique identifier used to pair this message with the subsequent {@link HandleAck} */
  handleId: string;
  /** Runtime type of the transferred handle, used by the child to route it correctly */
  handleType: 'socket' | 'server' | 'dgram' | 'fd';
}

/**
 * Handle acknowledgment sent from child to parent after handle is received.
 */
export interface HandleAck {
  /** Discriminant: always `'HANDLE_ACK'` */
  type: 'HANDLE_ACK';
  /** Matches {@link HandleMessage.handleId} of the handle being acknowledged */
  handleId: string;
  /** `true` if the child successfully received and registered the handle */
  received: boolean;
  /** Human-readable error description when `received` is `false` */
  error?: string;
}

/**
 * Dispose signal sent from child to parent to initiate graceful termination.
 * Child calls this when it needs to shut down and requests parent to terminate it.
 */
export interface ChildDispose {
  type: 'DISPOSE';
  // No payload - idempotent signal
}

/**
 * Union type of all IPC messages sent from parent to child.
 */
export type ParentToChildMessage =
  | InitMessage
  | Request
  | DisposeRequest
  | EventSubscribe
  | EventUnsubscribe
  | CallbackResult
  | CallbackError
  | PropertyResult
  | HandleMessage;

/**
 * Union type of all IPC messages sent from child to parent.
 */
export type ChildToParentMessage =
  | Response
  | EventMessage
  | InitSuccess
  | InitProperties
  | InitFailure
  | DisposeResponse
  | CallbackInvoke
  | PropertyGet
  | PropertySet
  | HandleAck
  | ChildDispose;
