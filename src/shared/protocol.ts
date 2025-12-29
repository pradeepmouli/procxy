import type { Jsonifiable } from 'type-fest';

/**
 * IPC message protocol types for Procxy parent-child communication.
 * All payloads use JSON serialization (Jsonifiable from type-fest).
 */

/**
 * Initialization message sent from parent to child on startup.
 * Contains module path, class name, and constructor arguments.
 */
export interface InitMessage {
  type: 'INIT';
  modulePath: string;        // Path to module to import (absolute or relative)
  className: string;         // Name of class to instantiate
  constructorArgs: [...Jsonifiable[]]; // Constructor arguments (rest parameter style)
}

/**
 * Method invocation request sent from parent to child.
 * Includes unique ID for request/response correlation.
 */
export interface Request {
  id: string;                // UUID v4 for correlation
  type: 'CALL';              // Only CALL supported in v1
  prop: string;              // Method name to invoke
  args: [...Jsonifiable[]];  // Method arguments (rest parameter style)
}

/**
 * Method invocation response sent from child to parent.
 * Either contains return value (RESULT) or error information (ERROR).
 */
export interface Response {
  id: string;                // Matches Request.id for correlation
  type: 'RESULT' | 'ERROR';
  value?: Jsonifiable;       // Return value (if type === 'RESULT')
  error?: ErrorInfo;         // Error details (if type === 'ERROR')
}

/**
 * Error information serialized in Response messages.
 * Preserves error message, stack trace, name, and optional code.
 */
export interface ErrorInfo {
  message: string;           // Error message
  stack?: string;            // Stack trace from child process
  name: string;              // Error name (e.g., 'TypeError', 'RangeError')
  code?: string;             // Optional error code (e.g., 'ENOENT', 'EACCES')
}

/**
 * Event message sent from child to parent for EventEmitter events.
 * Forwards events emitted in child to listeners in parent.
 */
export interface EventMessage {
  type: 'EVENT';
  eventName: string;         // Name of the event emitted
  args: [...Jsonifiable[]];  // Event arguments (rest parameter style)
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
 * Union type of all IPC messages sent from parent to child.
 */
export type ParentToChildMessage = InitMessage | Request;

/**
 * Union type of all IPC messages sent from child to parent.
 */
export type ChildToParentMessage = Response | EventMessage | InitSuccess | InitFailure;
