#!/usr/bin/env node

import { pathToFileURL } from 'node:url';
import type {
  InitMessage,
  ParentToChildMessage,
  ChildToParentMessage,
  ErrorInfo,
  InitFailure,
  InitSuccess,
  DisposeResponse
} from '../shared/protocol.js';
import type { SerializationMode } from '../types/options.js';
import { ModuleResolutionError } from '../shared/errors.js';
import {
  validateJsonifiableArray,
  validateV8SerializableArray,
  sanitizeForV8,
  sanitizeForV8Array
} from '../shared/serialization.js';
import { ChildProxy } from './child-proxy.js';

// Handle registry for received handles (sockets, servers, etc.)
const handleRegistry = new Map<string, any>();

let childProxy: ChildProxy | undefined;
let serializationMode: SerializationMode = 'json'; // Default to json mode
let sendFailureCount = 0;
let sanitizeRetryCount = 0;

function sanitizeMessageForParent(message: ChildToParentMessage): ChildToParentMessage {
  const seen = new WeakSet<object>();

  switch (message.type) {
    case 'EVENT':
      return { ...message, args: sanitizeForV8Array(message.args, seen) };
    case 'PROPERTY_SET':
      return { ...message, value: sanitizeForV8(message.value, seen) };
    case 'CALLBACK_INVOKE':
      return { ...message, args: sanitizeForV8Array(message.args, seen) };
    case 'RESULT':
      return { ...message, value: sanitizeForV8(message.value, seen) as any };
    default:
      return message;
  }
}

function sendToParent(message: ChildToParentMessage): void {
  if (!process.send) return;

  try {
    process.send(message);
  } catch (error) {
    sendFailureCount++;
    try {
      const sanitized = sanitizeMessageForParent(message);
      process.send(sanitized);
      sanitizeRetryCount++;
    } catch (fallbackError) {
      sendFailureCount++; // count the second failure as well
      console.warn('[procxy][child] Dropping message after serialization failure', {
        messageType: (message as any)?.type,
        sendFailures: sendFailureCount,
        sanitizeRetries: sanitizeRetryCount,
        error: (fallbackError as any)?.message ?? String(fallbackError)
      });
    }
  }
}

function toErrorInfo(error: unknown): ErrorInfo {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: (error as any).code
    };
  }

  return {
    name: 'Error',
    message: typeof error === 'string' ? error : 'Unknown error'
  };
}

async function handleInit(message: InitMessage): Promise<void> {
  try {
    // Store serialization mode for this child process
    serializationMode = message.serialization ?? 'json';

    // Validate constructor args based on serialization mode
    if (serializationMode === 'json') {
      validateJsonifiableArray(message.constructorArgs, 'constructor arguments');
    } else {
      validateV8SerializableArray(message.constructorArgs, 'constructor arguments');
    }

    let modulePath = message.modulePath;
    if (!modulePath.startsWith('file://')) {
      modulePath = pathToFileURL(modulePath).toString();
    }

    const importedModule = await import(modulePath);
    const TargetClass = importedModule[message.className];

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

    const instance = new TargetClass(...message.constructorArgs);
    childProxy = new ChildProxy(instance, sendToParent, serializationMode);

    const success: InitSuccess = { type: 'INIT_SUCCESS' };
    sendToParent(success);
  } catch (error) {
    const failure: InitFailure = {
      type: 'INIT_FAILURE',
      error: toErrorInfo(error)
    };
    sendToParent(failure);
    process.exit(1);
  }
}

async function handleParentMessage(message: ParentToChildMessage): Promise<void> {
  if (message.type === 'INIT') {
    await handleInit(message);
    return;
  }

  if (message.type === 'DISPOSE') {
    if (!childProxy) {
      const response: DisposeResponse = { type: 'DISPOSE_COMPLETE' };
      sendToParent(response);
      return;
    }

    try {
      await childProxy.disposableCleanup();
      const response: DisposeResponse = { type: 'DISPOSE_COMPLETE' };
      sendToParent(response);
    } catch (error) {
      const response: DisposeResponse = {
        type: 'DISPOSE_COMPLETE',
        error: toErrorInfo(error)
      };
      sendToParent(response);
    }
    return;
  }

  if (message.type === 'EVENT_SUBSCRIBE') {
    if (childProxy) {
      childProxy.subscribeEvent(message.eventName);
    }
    return;
  }

  if (message.type === 'EVENT_UNSUBSCRIBE') {
    if (childProxy) {
      childProxy.unsubscribeEvent(message.eventName);
    }
    return;
  }

  if (message.type === 'CALLBACK_RESULT' || message.type === 'CALLBACK_ERROR') {
    if (childProxy) {
      childProxy.handleCallbackResponse(message);
    }
    return;
  }

  if (message.type === 'PROPERTY_RESULT') {
    if (childProxy) {
      childProxy.handlePropertyResult(message);
    }
    return;
  }

  if (message.type === 'HANDLE') {
    // Handle messages are received separately via process.on('message') with handle parameter
    // This code path acknowledges that we received the handle metadata
    // The actual handle is stored via setupHandleListener()
    return;
  }

  if (!childProxy) {
    if ('id' in message) {
      const errorInfo = toErrorInfo(new Error('Child agent not initialized'));
      sendToParent({ type: 'ERROR', id: message.id, error: errorInfo });
    }
    return;
  }

  await childProxy.handleRequest(message);
}

function setupIpcListener(): void {
  if (!process.send) {
    console.error('Child agent must be run with IPC enabled (e.g., via child_process.fork)');
    process.exit(1);
  }

  // Set up handle listener first (handles are sent with messages)
  process.on('message', (msg: ParentToChildMessage, handle?: any) => {
    // If a handle is provided, this is a handle transfer message
    if (handle && msg.type === 'HANDLE') {
      const handleMsg = msg as import('../shared/protocol.js').HandleMessage;

      try {
        // Store the handle in registry
        handleRegistry.set(handleMsg.handleId, handle);

        // Send acknowledgment
        const ack: import('../shared/protocol.js').HandleAck = {
          type: 'HANDLE_ACK',
          handleId: handleMsg.handleId,
          received: true
        };
        sendToParent(ack);
      } catch (error) {
        // Send error acknowledgment
        const ack: import('../shared/protocol.js').HandleAck = {
          type: 'HANDLE_ACK',
          handleId: handleMsg.handleId,
          received: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
        sendToParent(ack);
      }
      return;
    }

    // Regular message handling
    handleParentMessage(msg).catch((error) => {
      console.error('Failed to handle IPC message:', error);
    });
  });

  process.on('disconnect', () => {
    process.exit(0);
  });
}

/**
 * Get a handle from the registry by ID.
 * Exposed for use by child proxies if needed.
 */
export function getHandle(handleId: string): any {
  return handleRegistry.get(handleId);
}

setupIpcListener();
