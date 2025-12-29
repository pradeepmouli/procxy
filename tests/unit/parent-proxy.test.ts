import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import type { Jsonifiable } from 'type-fest';

/**
 * Unit tests for parent-side Proxy handler
 *
 * Tests the handler that intercepts method calls on the parent-side proxy
 * and sends Request messages to the child process.
 */
describe('ParentProxyHandler', () => {
  let mockSendRequest: Mock<(method: string, args: Jsonifiable[]) => Promise<Jsonifiable>>;
  let proxy: any;

  beforeEach(() => {
    // Mock IPC client sendRequest function
    mockSendRequest = vi.fn();

    // TODO: Replace with actual ParentProxyHandler once implemented
    // For now, create a basic Proxy to test the expected behavior
    proxy = new Proxy({}, {
      get: (_target, prop) => {
        if (typeof prop === 'string' && !prop.startsWith('$')) {
          return (...args: Jsonifiable[]) => mockSendRequest(prop, args);
        }
        return undefined;
      }
    });
  });

  describe('method interception', () => {
    it('should intercept method calls and send Request messages', async () => {
      mockSendRequest.mockResolvedValue(42);

      const result = await proxy.add(10, 32);

      expect(mockSendRequest).toHaveBeenCalledWith('add', [10, 32]);
      expect(result).toBe(42);
    });

    it('should handle methods with no arguments', async () => {
      mockSendRequest.mockResolvedValue(true);

      const result = await proxy.isReady();

      expect(mockSendRequest).toHaveBeenCalledWith('isReady', []);
      expect(result).toBe(true);
    });

    it('should handle methods with complex arguments', async () => {
      const complexArg = { name: 'test', values: [1, 2, 3] };
      mockSendRequest.mockResolvedValue({ status: 'success' });

      const result = await proxy.process(complexArg, 'option');

      expect(mockSendRequest).toHaveBeenCalledWith('process', [complexArg, 'option']);
      expect(result).toEqual({ status: 'success' });
    });

    it('should validate method names (FR-014)', async () => {
      // Method names starting with $ should not be intercepted
      const $terminate = proxy.$terminate;
      expect($terminate).toBeUndefined();
      expect(mockSendRequest).not.toHaveBeenCalled();
    });

    it('should handle concurrent method calls independently', async () => {
      mockSendRequest
        .mockResolvedValueOnce('result1')
        .mockResolvedValueOnce('result2')
        .mockResolvedValueOnce('result3');

      const [r1, r2, r3] = await Promise.all([
        proxy.method1(),
        proxy.method2(),
        proxy.method3()
      ]);

      expect(r1).toBe('result1');
      expect(r2).toBe('result2');
      expect(r3).toBe('result3');
      expect(mockSendRequest).toHaveBeenCalledTimes(3);
    });
  });

  describe('error handling', () => {
    it('should propagate errors from child process', async () => {
      const error = new Error('Child process error');
      mockSendRequest.mockRejectedValue(error);

      await expect(proxy.failingMethod()).rejects.toThrow('Child process error');
    });

    it('should handle timeout errors', async () => {
      mockSendRequest.mockRejectedValue(new Error('Request timeout'));

      await expect(proxy.slowMethod()).rejects.toThrow('Request timeout');
    });
  });

  describe('return value handling', () => {
    it('should handle primitive return values', async () => {
      mockSendRequest.mockResolvedValue(123);
      expect(await proxy.getNumber()).toBe(123);

      mockSendRequest.mockResolvedValue('hello');
      expect(await proxy.getString()).toBe('hello');

      mockSendRequest.mockResolvedValue(true);
      expect(await proxy.getBoolean()).toBe(true);

      mockSendRequest.mockResolvedValue(null);
      expect(await proxy.getNull()).toBe(null);
    });

    it('should handle object return values', async () => {
      const obj = { id: 1, name: 'test', nested: { value: 42 } };
      mockSendRequest.mockResolvedValue(obj);

      const result = await proxy.getObject();
      expect(result).toEqual(obj);
    });

    it('should handle array return values', async () => {
      const arr = [1, 2, 3, 'four', { five: 5 }];
      mockSendRequest.mockResolvedValue(arr);

      const result = await proxy.getArray();
      expect(result).toEqual(arr);
    });
  });
});
