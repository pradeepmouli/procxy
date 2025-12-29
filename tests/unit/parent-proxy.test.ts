import { EventEmitter } from 'node:events';
import { describe, it, expect, vi } from 'vitest';
import type { Jsonifiable } from 'type-fest';
import { createParentProxy } from '../../src/parent/parent-proxy.js';
import { ProcxyError } from '../../src/shared/errors.js';
import type { IPCClient } from '../../src/parent/ipc-client.js';

class FakeIPCClient extends EventEmitter {
  process = { pid: 1234 } as any;
  sendRequest = vi.fn(async (_method: string, _args: [...Jsonifiable[]]): Promise<any> => 'ok');
  terminate = vi.fn(async () => {});
}

describe('Parent proxy', () => {
  it('forwards method calls to IPC client', async () => {
    const ipc = new FakeIPCClient();
    const proxy = createParentProxy<any>(ipc as unknown as IPCClient);

    ipc.sendRequest.mockResolvedValueOnce(42);
    const result = await proxy.add(10, 32);

    expect(ipc.sendRequest).toHaveBeenCalledWith('add', [10, 32]);
    expect(result).toBe(42);
  });

  it('validates method names and rejects reserved ones', async () => {
    const ipc = new FakeIPCClient();
    const proxy = createParentProxy<any>(ipc as unknown as IPCClient);

    expect(() => (proxy as any)['invalid-name']()).toThrow(ProcxyError);
    expect(() => (proxy as any).$private()).toThrow(ProcxyError);
  });

  it('exposes $terminate and $process lifecycle helpers', async () => {
    const ipc = new FakeIPCClient();
    const proxy = createParentProxy<any>(ipc as unknown as IPCClient);

    await proxy.$terminate();
    expect(ipc.terminate).toHaveBeenCalled();
    expect(proxy.$process.pid).toBe(1234);
  });

  it('forwards event listeners to IPC client EventEmitter', async () => {
    const ipc = new FakeIPCClient();
    const proxy = createParentProxy<any>(ipc as unknown as IPCClient);

    const handler = vi.fn();
    proxy.on('done', handler);

    ipc.emit('done', 'payload');
    expect(handler).toHaveBeenCalledWith('payload');
  });

  it('supports complex argument forwarding', async () => {
    const ipc = new FakeIPCClient();
    const proxy = createParentProxy<any>(ipc as unknown as IPCClient);
    const payload = { nested: ['a', 'b'] };

    await proxy.process(payload, 5);
    expect(ipc.sendRequest).toHaveBeenCalledWith('process', [payload, 5]);
  });
});
