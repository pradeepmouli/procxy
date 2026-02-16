import { EventEmitter } from 'node:events';
import { describe, it, expect } from 'vitest';
import { IPCClient } from '../../src/parent/ipc-client.js';

class FakeChildProcess extends EventEmitter {
  connected = true;
  killed = false;
  send = (_message: unknown, _handle?: unknown, callback?: (error: Error | null) => void): void => {
    callback?.(null);
  };
  kill = (): void => {
    this.killed = true;
  };
}

describe('IPCClient.sendHandle', () => {
  it('fails fast on Bun with a clear error', async () => {
    const child = new FakeChildProcess();
    const client = new IPCClient(child as any, 30000, 3);

    const versions = process.versions as Record<string, string | undefined>;
    const previousBunVersion = versions.bun;
    versions.bun = '1.3.9';

    try {
      await expect(client.sendHandle({} as any)).rejects.toThrow(
        'Handle passing is not currently supported on Bun'
      );
    } finally {
      if (previousBunVersion === undefined) {
        delete versions.bun;
      } else {
        versions.bun = previousBunVersion;
      }
    }
  });
});
