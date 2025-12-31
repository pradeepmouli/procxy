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
import { ModuleResolutionError } from '../shared/errors.js';
import { validateJsonifiableArray } from '../shared/serialization.js';
import { ChildProxy } from './child-proxy.js';

let childProxy: ChildProxy | undefined;

function sendToParent(message: ChildToParentMessage): void {
  if (process.send) {
    process.send(message);
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
    validateJsonifiableArray(message.constructorArgs, 'constructor arguments');

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
    childProxy = new ChildProxy(instance, sendToParent);

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
      await childProxy.dispose();
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

  if (!childProxy) {
    const errorInfo = toErrorInfo(new Error('Child agent not initialized'));
    sendToParent({ type: 'ERROR', id: message.id, error: errorInfo });
    return;
  }

  await childProxy.handleRequest(message);
}

function setupIpcListener(): void {
  if (!process.send) {
    console.error('Child agent must be run with IPC enabled (e.g., via child_process.fork)');
    process.exit(1);
  }

  process.on('message', (msg: ParentToChildMessage) => {
    handleParentMessage(msg).catch((error) => {
      console.error('Failed to handle IPC message:', error);
    });
  });

  process.on('disconnect', () => {
    process.exit(0);
  });
}

setupIpcListener();
