import { describe, it, expect, beforeEach } from 'vitest';
import { ChildProxy } from '../../src/child/child-proxy.js';
import type { Request, Response, ChildToParentMessage } from '../../src/shared/protocol.js';

describe('ChildProxy', () => {
  let messages: ChildToParentMessage[];
  let send: (message: ChildToParentMessage) => void;
  let target: any;

  beforeEach(() => {
    messages = [];
    send = (message) => {
      messages.push(message);
    };

    target = {
      add: (a: number, b: number) => a + b,
      asyncValue: async (value: string) => value.toUpperCase(),
      throwSync: () => {
        throw new Error('boom');
      }
    };
  });

  it('invokes target methods and returns RESULT', async () => {
    const proxy = new ChildProxy(target, send);
    const request: Request = { type: 'CALL', id: '1', prop: 'add', args: [3, 4] };

    await proxy.handleRequest(request);

    expect(messages).toHaveLength(1);
    expect(messages[0]).toEqual({ type: 'RESULT', id: '1', value: 7 });
  });

  it('handles async methods', async () => {
    const proxy = new ChildProxy(target, send);
    const request: Request = { type: 'CALL', id: '2', prop: 'asyncValue', args: ['hi'] };

    await proxy.handleRequest(request);

    expect(messages[0]).toEqual({ type: 'RESULT', id: '2', value: 'HI' });
  });

  it('returns ERROR response for missing method', async () => {
    const proxy = new ChildProxy(target, send);
    const request: Request = { type: 'CALL', id: '3', prop: 'missing', args: [] };

    await proxy.handleRequest(request);

    const response = messages[0] as Response;
    expect(response.type).toBe('ERROR');
    expect(response.id).toBe('3');
    expect(response.error?.message).toContain('does not exist');
  });

  it('serializes thrown errors into ERROR responses', async () => {
    const proxy = new ChildProxy(target, send);
    const request: Request = { type: 'CALL', id: '4', prop: 'throwSync', args: [] };

    await proxy.handleRequest(request);

    const response = messages[0] as Response;
    expect(response.type).toBe('ERROR');
    expect(response.error?.name).toBe('Error');
    expect(response.error?.message).toBe('boom');
  });
});
