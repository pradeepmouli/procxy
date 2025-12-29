import { describe, it, expect, expectTypeOf } from 'vitest';
import type {
  InitMessage,
  Request,
  Response,
  ErrorInfo,
  EventMessage,
  InitSuccess,
  InitFailure,
  ParentToChildMessage,
  ChildToParentMessage,
} from '../../src/shared/protocol.js';

describe('Protocol Message Types', () => {
  describe('InitMessage', () => {
    it('should have correct structure', () => {
      const msg: InitMessage = {
        type: 'INIT',
        modulePath: '/path/to/module.ts',
        className: 'Worker',
        constructorArgs: [1, 'test', { key: 'value' }],
      };

      expect(msg.type).toBe('INIT');
      expect(msg.modulePath).toBe('/path/to/module.ts');
      expect(msg.className).toBe('Worker');
      expect(msg.constructorArgs).toEqual([1, 'test', { key: 'value' }]);
    });

    it('should accept empty constructor args', () => {
      const msg: InitMessage = {
        type: 'INIT',
        modulePath: '/path/to/module.ts',
        className: 'Worker',
        constructorArgs: [],
      };

      expect(msg.constructorArgs).toEqual([]);
    });

    it('should accept only JSON-serializable args', () => {
      const msg: InitMessage = {
        type: 'INIT',
        modulePath: '/path/to/module.ts',
        className: 'Worker',
        constructorArgs: [
          null,
          42,
          'string',
          true,
          { nested: { deeply: [1, 2, 3] } },
          [1, 2, 3],
        ],
      };

      expect(JSON.stringify(msg.constructorArgs)).toBeTruthy();
    });
  });

  describe('Request', () => {
    it('should have correct structure', () => {
      const msg: Request = {
        id: 'uuid-1234',
        type: 'CALL',
        prop: 'calculateSum',
        args: [10, 20],
      };

      expect(msg.id).toBe('uuid-1234');
      expect(msg.type).toBe('CALL');
      expect(msg.prop).toBe('calculateSum');
      expect(msg.args).toEqual([10, 20]);
    });

    it('should accept empty args', () => {
      const msg: Request = {
        id: 'uuid-5678',
        type: 'CALL',
        prop: 'getValue',
        args: [],
      };

      expect(msg.args).toEqual([]);
    });

    it('should require CALL type', () => {
      const msg: Request = {
        id: 'uuid-abcd',
        type: 'CALL',
        prop: 'method',
        args: [],
      };

      expectTypeOf(msg.type).toEqualTypeOf<'CALL'>();
    });
  });

  describe('Response', () => {
    it('should support RESULT type with value', () => {
      const msg: Response = {
        id: 'uuid-1234',
        type: 'RESULT',
        value: { result: 42 },
      };

      expect(msg.type).toBe('RESULT');
      expect(msg.value).toEqual({ result: 42 });
      expect(msg.error).toBeUndefined();
    });

    it('should support ERROR type with error info', () => {
      const msg: Response = {
        id: 'uuid-5678',
        type: 'ERROR',
        error: {
          message: 'Something went wrong',
          name: 'Error',
          stack: 'Error: Something went wrong\n    at ...',
          code: 'ERR_CUSTOM',
        },
      };

      expect(msg.type).toBe('ERROR');
      expect(msg.error).toBeDefined();
      expect(msg.error?.message).toBe('Something went wrong');
      expect(msg.value).toBeUndefined();
    });

    it('should handle null as valid value', () => {
      const msg: Response = {
        id: 'uuid-null',
        type: 'RESULT',
        value: null,
      };

      expect(msg.value).toBeNull();
    });

    it('should handle undefined as valid value', () => {
      const msg: Response = {
        id: 'uuid-undef',
        type: 'RESULT',
        value: undefined,
      };

      expect(msg.value).toBeUndefined();
    });
  });

  describe('ErrorInfo', () => {
    it('should have required fields', () => {
      const error: ErrorInfo = {
        message: 'Test error',
        name: 'TestError',
      };

      expect(error.message).toBe('Test error');
      expect(error.name).toBe('TestError');
    });

    it('should support optional stack and code', () => {
      const error: ErrorInfo = {
        message: 'Test error',
        name: 'TestError',
        stack: 'Error stack trace...',
        code: 'E_TEST',
      };

      expect(error.stack).toBe('Error stack trace...');
      expect(error.code).toBe('E_TEST');
    });

    it('should handle various error names', () => {
      const errors: ErrorInfo[] = [
        { message: 'Type error', name: 'TypeError' },
        { message: 'Range error', name: 'RangeError' },
        { message: 'Reference error', name: 'ReferenceError' },
        { message: 'Custom error', name: 'CustomError' },
      ];

      errors.forEach(err => {
        expect(err.name).toBeTruthy();
        expect(err.message).toBeTruthy();
      });
    });
  });

  describe('EventMessage', () => {
    it('should have correct structure', () => {
      const msg: EventMessage = {
        type: 'EVENT',
        eventName: 'data',
        args: [{ value: 42 }],
      };

      expect(msg.type).toBe('EVENT');
      expect(msg.eventName).toBe('data');
      expect(msg.args).toEqual([{ value: 42 }]);
    });

    it('should support events with no arguments', () => {
      const msg: EventMessage = {
        type: 'EVENT',
        eventName: 'ready',
        args: [],
      };

      expect(msg.args).toEqual([]);
    });

    it('should support events with multiple arguments', () => {
      const msg: EventMessage = {
        type: 'EVENT',
        eventName: 'progress',
        args: [50, 100, 'Processing...'],
      };

      expect(msg.args).toEqual([50, 100, 'Processing...']);
    });
  });

  describe('InitSuccess', () => {
    it('should have correct structure', () => {
      const msg: InitSuccess = {
        type: 'INIT_SUCCESS',
      };

      expect(msg.type).toBe('INIT_SUCCESS');
    });
  });

  describe('InitFailure', () => {
    it('should have correct structure', () => {
      const msg: InitFailure = {
        type: 'INIT_FAILURE',
        error: {
          message: 'Failed to initialize',
          name: 'InitError',
        },
      };

      expect(msg.type).toBe('INIT_FAILURE');
      expect(msg.error.message).toBe('Failed to initialize');
    });
  });

  describe('Union Types', () => {
    it('should accept all parent-to-child message types', () => {
      const messages: ParentToChildMessage[] = [
        {
          type: 'INIT',
          modulePath: '/path',
          className: 'Worker',
          constructorArgs: [],
        },
        {
          id: 'uuid',
          type: 'CALL',
          prop: 'method',
          args: [],
        },
      ];

      expect(messages).toHaveLength(2);
    });

    it('should accept all child-to-parent message types', () => {
      const messages: ChildToParentMessage[] = [
        {
          id: 'uuid',
          type: 'RESULT',
          value: 42,
        },
        {
          id: 'uuid',
          type: 'ERROR',
          error: { message: 'error', name: 'Error' },
        },
        {
          type: 'EVENT',
          eventName: 'data',
          args: [],
        },
        {
          type: 'INIT_SUCCESS',
        },
        {
          type: 'INIT_FAILURE',
          error: { message: 'error', name: 'Error' },
        },
      ];

      expect(messages).toHaveLength(5);
    });
  });

  describe('JSON Serialization', () => {
    it('should serialize InitMessage correctly', () => {
      const msg: InitMessage = {
        type: 'INIT',
        modulePath: '/path/to/module.ts',
        className: 'Worker',
        constructorArgs: [1, 'test'],
      };

      const json = JSON.stringify(msg);
      const parsed = JSON.parse(json);

      expect(parsed).toEqual(msg);
    });

    it('should serialize Request correctly', () => {
      const msg: Request = {
        id: 'uuid-1234',
        type: 'CALL',
        prop: 'method',
        args: [{ key: 'value' }],
      };

      const json = JSON.stringify(msg);
      const parsed = JSON.parse(json);

      expect(parsed).toEqual(msg);
    });

    it('should serialize Response correctly', () => {
      const msg: Response = {
        id: 'uuid-5678',
        type: 'RESULT',
        value: { result: [1, 2, 3] },
      };

      const json = JSON.stringify(msg);
      const parsed = JSON.parse(json);

      expect(parsed).toEqual(msg);
    });

    it('should serialize EventMessage correctly', () => {
      const msg: EventMessage = {
        type: 'EVENT',
        eventName: 'data',
        args: [1, 'two', { three: 3 }],
      };

      const json = JSON.stringify(msg);
      const parsed = JSON.parse(json);

      expect(parsed).toEqual(msg);
    });
  });
});
