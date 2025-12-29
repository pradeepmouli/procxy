import type { Jsonifiable } from 'type-fest';
import type { Procxy } from '../types/procxy.js';
import { validateJsonifiableArray } from '../shared/serialization.js';
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

      return (...args: Jsonifiable[]) => {
        validateJsonifiableArray(args as unknown[], `method '${prop}' arguments`);
        return ipcClient.sendRequest(prop, args);
      };
    },
  });

  return proxy as unknown as Procxy<T>;
}
