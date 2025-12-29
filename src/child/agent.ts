#!/usr/bin/env node

/**
 * Child agent entry point.
 *
 * This script runs in the child process and:
 * 1. Listens for InitMessage from parent
 * 2. Dynamically imports the target module
 * 3. Instantiates the target class with constructor args
 * 4. Sets up IPC message handlers
 * 5. Proxies method invocations and sends responses
 */

import type { InitMessage, Request, Response, ChildToParentMessage, ParentToChildMessage } from '../shared/protocol.js';
import { ModuleResolutionError } from '../shared/errors.js';
import { deserializeFromJson, serializeToJson } from '../shared/serialization.js';

let targetInstance: any = null;
let isInitialized = false;

/**
 * Send a message to the parent process.
 */
function sendToParent(message: ChildToParentMessage): void {
  if (process.send) {
    process.send(message);
  }
}

/**
 * Send an error response to the parent.
 */
function sendErrorResponse(id: string, error: Error): void {
  const response: Response = {
    type: 'ERROR',
    id,
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: (error as any).code
    }
  };
  sendToParent(response);
}

/**
 * Send a success response to the parent.
 */
function sendSuccessResponse(id: string, value: any): void {
  try {
    const serializedValue = serializeToJson(value, 'response value');
    const deserializedValue = deserializeFromJson(serializedValue, 'response value');

    const response: Response = {
      type: 'RESULT',
      id,
      value: deserializedValue
    };
    sendToParent(response);
  } catch (error) {
    sendErrorResponse(id, error as Error);
  }
}

/**
 * Handle InitMessage - import module and instantiate class.
 */
async function handleInit(message: InitMessage): Promise<void> {
  try {
    // Import the module
    let modulePath = message.modulePath;

    // Convert to file:// URL if not already
    if (!modulePath.startsWith('file://')) {
      modulePath = `file://${modulePath}`;
    }

    const module = await import(modulePath);

    // Get the class from the module
    const TargetClass = module[message.className];

    if (!TargetClass) {
      throw new ModuleResolutionError(
        message.className,
        `Class not found in module '${message.modulePath}'`
      );
    }

    if (typeof TargetClass !== 'function') {
      throw new ModuleResolutionError(
        message.className,
        `'${message.className}' is not a constructor`
      );
    }

    // Instantiate with constructor args
    targetInstance = new TargetClass(...message.constructorArgs);
    isInitialized = true;

  } catch (error) {
    // Fatal error - cannot proceed without valid instance
    console.error('Child agent initialization failed:', error);
    process.exit(1);
  }
}

/**
 * Handle Request - invoke method on target instance.
 */
async function handleRequest(message: Request): Promise<void> {
  if (!isInitialized || !targetInstance) {
    sendErrorResponse(message.id, new Error('Child agent not initialized'));
    return;
  }

  try {
    // Validate method exists
    const method = targetInstance[message.prop];

    if (typeof method !== 'function') {
      throw new Error(`Method '${message.prop}' does not exist or is not a function`);
    }

    // Invoke the method
    const result = await method.apply(targetInstance, message.args);

    // Send success response
    sendSuccessResponse(message.id, result);

  } catch (error) {
    // Send error response
    sendErrorResponse(message.id, error as Error);
  }
}

/**
 * Main message handler.
 */
function handleMessage(message: ParentToChildMessage): void {
  if (message.type === 'INIT') {
    handleInit(message).catch((error) => {
      console.error('Failed to handle INIT message:', error);
      process.exit(1);
    });
  } else if (message.type === 'CALL') {
    handleRequest(message).catch((error) => {
      console.error('Failed to handle CALL message:', error);
    });
  }
}

// Set up IPC listener
if (process.send) {
  process.on('message', handleMessage);

  // Signal readiness
  process.send({ type: 'READY' });
} else {
  console.error('Child agent must be run with IPC enabled (e.g., via child_process.fork)');
  process.exit(1);
}

// Handle process termination
process.on('disconnect', () => {
  process.exit(0);
});
