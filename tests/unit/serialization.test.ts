import { describe, it, expect } from 'vitest';
import {
  validateJsonifiable,
  validateJsonifiableArray,
  serializeToJson,
  deserializeFromJson
} from '../../src/shared/serialization.js';
import { SerializationError } from '../../src/shared/errors.js';

describe('Serialization Utilities', () => {
  describe('validateJsonifiable', () => {
    it('should accept valid JSON primitives', () => {
      expect(() => validateJsonifiable(null, 'test')).not.toThrow();
      expect(() => validateJsonifiable(42, 'test')).not.toThrow();
      expect(() => validateJsonifiable('string', 'test')).not.toThrow();
      expect(() => validateJsonifiable(true, 'test')).not.toThrow();
      expect(() => validateJsonifiable(false, 'test')).not.toThrow();
    });

    it('should accept valid JSON objects', () => {
      expect(() =>
        validateJsonifiable({ key: 'value', nested: { deep: 1 } }, 'test')
      ).not.toThrow();
      expect(() => validateJsonifiable({ a: 1, b: 2, c: 3 }, 'test')).not.toThrow();
    });

    it('should accept valid JSON arrays', () => {
      expect(() => validateJsonifiable([1, 2, 3], 'test')).not.toThrow();
      expect(() => validateJsonifiable(['a', 'b', 'c'], 'test')).not.toThrow();
      expect(() => validateJsonifiable([{ nested: [1, 2, 3] }], 'test')).not.toThrow();
    });

    it('should accept functions (JSON.stringify converts to undefined)', () => {
      // Note: JSON.stringify converts functions to undefined, which is valid
      const fn = () => {};
      expect(() => validateJsonifiable(fn, 'test function')).not.toThrow();
    });

    it('should accept undefined (JSON.stringify omits it)', () => {
      // Note: JSON.stringify omits undefined in objects, converts to null in arrays
      expect(() => validateJsonifiable(undefined, 'test undefined')).not.toThrow();
    });

    it('should accept symbols (JSON.stringify converts to undefined)', () => {
      // Note: JSON.stringify converts symbols to undefined
      const sym = Symbol('test');
      expect(() => validateJsonifiable(sym, 'test symbol')).not.toThrow();
    });

    it('should reject circular references', () => {
      const obj: any = { a: 1 };
      obj.self = obj;

      expect(() => validateJsonifiable(obj, 'circular object')).toThrow(SerializationError);
    });

    it('should reject BigInt values', () => {
      const bigInt = BigInt(123);
      expect(() => validateJsonifiable(bigInt, 'test bigint')).toThrow(SerializationError);
    });

    it('should include context in error message', () => {
      const circular: any = { a: 1 };
      circular.self = circular;

      try {
        validateJsonifiable(circular, 'constructor argument');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(SerializationError);
        expect((error as SerializationError).message).toContain('constructor argument');
      }
    });
  });

  describe('validateJsonifiableArray', () => {
    it('should accept empty array', () => {
      expect(() => validateJsonifiableArray([], 'test')).not.toThrow();
    });

    it('should accept array of valid JSON values', () => {
      expect(() =>
        validateJsonifiableArray([1, 'two', { three: 3 }, null, true], 'test')
      ).not.toThrow();
    });

    it('should reject array with function (unless callback registry provided)', () => {
      // Functions are not JSON-serializable and should be rejected
      // unless a callback registry is provided (for callback proxying)
      const arr = [1, 2, () => {}];
      expect(() => validateJsonifiableArray(arr, 'test array')).toThrow(SerializationError);
    });

    it('should accept array with undefined (JSON.stringify converts to null)', () => {
      // Note: JSON.stringify converts undefined to null in arrays
      const arr = [1, undefined, 3];
      expect(() => validateJsonifiableArray(arr, 'test array')).not.toThrow();
    });

    it('should accept array with symbol (JSON.stringify converts to null)', () => {
      // Note: JSON.stringify converts symbols to null in arrays
      const arr = [1, 2, Symbol('test')];
      expect(() => validateJsonifiableArray(arr, 'test array')).not.toThrow();
    });

    it('should include index in error message', () => {
      const circular: any = { a: 1 };
      circular.self = circular;
      const arr = [1, 2, circular, 4];

      try {
        validateJsonifiableArray(arr, 'method arguments');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(SerializationError);
        expect((error as SerializationError).message).toContain('[2]');
      }
    });

    it('should reject on first invalid element', () => {
      const circular1: any = { a: 1 };
      circular1.self = circular1;
      const circular2: any = { b: 2 };
      circular2.self = circular2;

      const arr = [circular1, circular2, 3];

      try {
        validateJsonifiableArray(arr, 'test');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(SerializationError);
        expect((error as SerializationError).message).toContain('[0]');
      }
    });
  });

  describe('serializeToJson', () => {
    it('should serialize primitives', () => {
      expect(serializeToJson(null, 'test')).toBe('null');
      expect(serializeToJson(42, 'test')).toBe('42');
      expect(serializeToJson('string', 'test')).toBe('"string"');
      expect(serializeToJson(true, 'test')).toBe('true');
    });

    it('should serialize objects', () => {
      const obj = { a: 1, b: 'two', c: null };
      const json = serializeToJson(obj, 'test');
      expect(json).toBe('{"a":1,"b":"two","c":null}');
    });

    it('should serialize arrays', () => {
      const arr = [1, 2, 3];
      const json = serializeToJson(arr, 'test');
      expect(json).toBe('[1,2,3]');
    });

    it('should serialize nested structures', () => {
      const data = {
        users: [
          { id: 1, name: 'Alice' },
          { id: 2, name: 'Bob' }
        ],
        count: 2
      };
      const json = serializeToJson(data, 'test');
      expect(JSON.parse(json)).toEqual(data);
    });

    it('should serialize objects (functions become undefined)', () => {
      const obj = { fn: () => {} };
      const json = serializeToJson(obj as any, 'test object');
      expect(json).toBe('{}'); // functions are omitted
    });

    it('should include context in error message for circular refs', () => {
      const circular: any = { a: 1 };
      circular.self = circular;

      try {
        serializeToJson(circular as any, 'response value');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(SerializationError);
        expect((error as SerializationError).message).toContain('response value');
      }
    });
  });

  describe('deserializeFromJson', () => {
    it('should deserialize primitives', () => {
      expect(deserializeFromJson('null', 'test')).toBe(null);
      expect(deserializeFromJson('42', 'test')).toBe(42);
      expect(deserializeFromJson('"string"', 'test')).toBe('string');
      expect(deserializeFromJson('true', 'test')).toBe(true);
    });

    it('should deserialize objects', () => {
      const json = '{"a":1,"b":"two","c":null}';
      const obj = deserializeFromJson(json, 'test');
      expect(obj).toEqual({ a: 1, b: 'two', c: null });
    });

    it('should deserialize arrays', () => {
      const json = '[1,2,3]';
      const arr = deserializeFromJson(json, 'test');
      expect(arr).toEqual([1, 2, 3]);
    });

    it('should deserialize nested structures', () => {
      const data = {
        users: [
          { id: 1, name: 'Alice' },
          { id: 2, name: 'Bob' }
        ],
        count: 2
      };
      const json = JSON.stringify(data);
      const parsed = deserializeFromJson(json, 'test');
      expect(parsed).toEqual(data);
    });

    it('should throw SerializationError for malformed JSON', () => {
      expect(() => deserializeFromJson('{invalid json', 'test')).toThrow(SerializationError);
      expect(() => deserializeFromJson('{"key": undefined}', 'test')).toThrow(SerializationError);
    });

    it('should include context in error message', () => {
      try {
        deserializeFromJson('{bad json}', 'request payload');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(SerializationError);
        expect((error as SerializationError).message).toContain('request payload');
      }
    });

    it('should handle empty strings as invalid JSON', () => {
      expect(() => deserializeFromJson('', 'empty')).toThrow(SerializationError);
    });
  });

  describe('Round-trip serialization', () => {
    it('should preserve data through serialize-deserialize cycle', () => {
      const data = {
        id: 123,
        name: 'Test Object',
        nested: {
          array: [1, 2, 3],
          boolean: true,
          nullable: null
        }
      };

      const json = serializeToJson(data, 'test');
      const parsed = deserializeFromJson(json, 'test');

      expect(parsed).toEqual(data);
    });

    it('should handle complex nested arrays', () => {
      const data = [
        [1, 2],
        [3, 4],
        [5, 6]
      ];

      const json = serializeToJson(data, 'test');
      const parsed = deserializeFromJson(json, 'test');

      expect(parsed).toEqual(data);
    });

    it('should handle mixed types in arrays', () => {
      const data = [1, 'string', null, true, { key: 'value' }];

      const json = serializeToJson(data, 'test');
      const parsed = deserializeFromJson(json, 'test');

      expect(parsed).toEqual(data);
    });
  });
});
