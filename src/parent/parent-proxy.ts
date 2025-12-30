import type { Jsonifiable } from 'type-fest';
import type { Procxy } from '../types/procxy.js';
import { ProcxyError } from '../shared/errors.js';
import { IPCClient } from './ipc-client.js';

const eventMethods = new Set([
  'on',
  'once',
  'off',
  'addListener',
  'removeListener',
  'removeAllListeners',
  'emit',
  'listeners',
  'listenerCount',
  'eventNames'
]);

function isValidIdentifier(name: string): boolean {
  return /^[A-Za-z_$][\w$]*$/.test(name);
}

/**
 * Create the parent-side proxy that forwards method calls to the IPC client.
 */
export function createParentProxy<T extends object>(ipcClient: IPCClient): Procxy<T> {
  const base: T = {} as T;

  const proxy = new Proxy<T>(base, {
    get: (_target, prop) => {
      if (prop === 'then') {
        return undefined;
      }

      if (prop === '$terminate') {
        return () => ipcClient.terminate();
      }

      if (prop === '$process') {
        return ipcClient.process;
      }

      // Disposable protocol support
      if (prop === Symbol.dispose) {
        return () => {
          // Synchronous dispose - initiate termination but don't await
          void ipcClient.terminate();
        };
      }

      if (prop === Symbol.asyncDispose) {
        return () => ipcClient.terminate();
      }

      if (typeof prop === 'symbol') {
        return undefined;
      }

      if (eventMethods.has(prop)) {
        const handler = (ipcClient as any)[prop];
        return typeof handler === 'function' ? handler.bind(ipcClient) : undefined;
      }

      if (typeof prop !== 'string') {
        return undefined;
      }

      if (prop.startsWith('$')) {
        throw new ProcxyError(`Method '${prop}' is reserved and cannot be invoked`);
      }

      if (!isValidIdentifier(prop)) {
        throw new ProcxyError(`Invalid method name '${prop}' (FR-014)`);
      }

      // Check if this property exists in the property store (it's a property, not a method)
      if (ipcClient.hasProperty(prop)) {
        return ipcClient.getPropertySync(prop);
      }

      return (...args: Jsonifiable[]) => {
        // Note: Validation and callback serialization happens in IPCClient.sendRequest
        return ipcClient.sendRequest(prop, args);
      };
    },

    set: (_target, prop, _value) => {
      if (typeof prop !== 'string') {
        return false;
      }

      if (prop.startsWith('$')) {
        throw new ProcxyError(`Property '${prop}' is reserved and cannot be set`);
      }

      if (!isValidIdentifier(prop)) {
        throw new ProcxyError(`Invalid property name '${prop}'`);
      }

      // Parent cannot set properties - only child can set, parent reads from store
      throw new ProcxyError(
        `Cannot set property '${prop}' from parent. Properties are read-only on parent and can only be modified by child.`
      );
    }
  });

  return proxy as unknown as Procxy<T>;
}
