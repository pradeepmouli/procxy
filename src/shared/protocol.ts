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
  type: 'INIT';
  modulePath: string; // Path to module to import (absolute or relative)
  className: string; // Name of class to instantiate
  constructorArgs: [...Jsonifiable[]]; // Constructor arguments (rest parameter style)
  serialization?: SerializationMode; // Serialization mode ('json' or 'advanced')
}

/**
 * Method invocation request sent from parent to child.
 * Includes unique ID for request/response correlation.
 */
export interface Request {
  id: string; // UUID v4 for correlation
  type: 'CALL'; // Only CALL supported in v1
  prop: string; // Method name to invoke
  args: [...Jsonifiable[]]; // Method arguments (rest parameter style)
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
  id: string; // Matches Request.id for correlation
  type: 'RESULT' | 'ERROR';
  value?: Jsonifiable; // Return value (if type === 'RESULT')
  error?: ErrorInfo; // Error details (if type === 'ERROR')
}

/**
 * Error information serialized in Response messages.
 * Preserves error message, stack trace, name, and optional code.
 */
export interface ErrorInfo {
  message: string; // Error message
  stack?: string; // Stack trace from child process
  name: string; // Error name (e.g., 'TypeError', 'RangeError')
  code?: string; // Optional error code (e.g., 'ENOENT', 'EACCES')
}

/**
 * Event message sent from child to parent for EventEmitter events.
 * Forwards events emitted in child to listeners in parent.
 */
export interface EventMessage {
  type: 'EVENT';
  eventName: string; // Name of the event emitted
  args: [...Jsonifiable[]]; // Event arguments (rest parameter style)
}

/**
 * Initialization success message sent from child to parent after instance is created.
 */
export interface InitSuccess {
  type: 'INIT_SUCCESS';
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
  type: 'HANDLE';
  handleId: string; // Unique identifier for the handle
  handleType: 'socket' | 'server' | 'dgram' | 'fd'; // Type of handle for validation
}

/**
 * Handle acknowledgment sent from child to parent after handle is received.
 */
export interface HandleAck {
  type: 'HANDLE_ACK';
  handleId: string; // Matches HandleMessage.handleId
  received: boolean; // Whether handle was successfully received
  error?: string; // Error message if handle reception failed
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
  | InitFailure
  | DisposeResponse
  | CallbackInvoke
  | PropertyGet
  | PropertySet
  | HandleAck;
