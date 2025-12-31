import { describe, it, expect } from 'vitest';
import {
  isV8Serializable,
  validateV8Serializable,
  validateV8SerializableArray
} from '../../src/shared/serialization.js';
import { SerializationError } from '../../src/shared/errors.js';

describe('V8 Serialization Utilities', () => {
  describe('isV8Serializable', () => {
    it('should accept null and undefined', () => {
      expect(isV8Serializable(null)).toBe(true);
      expect(isV8Serializable(undefined)).toBe(true);
    });

    it('should accept primitive types', () => {
      expect(isV8Serializable(42)).toBe(true);
      expect(isV8Serializable('string')).toBe(true);
      expect(isV8Serializable(true)).toBe(true);
      expect(isV8Serializable(false)).toBe(true);
    });

    it('should accept BigInt', () => {
      expect(isV8Serializable(BigInt(123))).toBe(true);
      expect(isV8Serializable(BigInt('999999999999999999'))).toBe(true);
      expect(isV8Serializable(9007199254740991n)).toBe(true);
    });

    it('should accept NaN and Infinity', () => {
      expect(isV8Serializable(NaN)).toBe(true);
      expect(isV8Serializable(Infinity)).toBe(true);
      expect(isV8Serializable(-Infinity)).toBe(true);
    });

    it('should accept Date objects', () => {
      expect(isV8Serializable(new Date())).toBe(true);
      expect(isV8Serializable(new Date('2024-01-01'))).toBe(true);
    });

    it('should accept RegExp objects', () => {
      expect(isV8Serializable(/test/)).toBe(true);
      expect(isV8Serializable(new RegExp('pattern', 'gi'))).toBe(true);
    });

    it('should accept Error objects', () => {
      expect(isV8Serializable(new Error('test'))).toBe(true);
      expect(isV8Serializable(new TypeError('type error'))).toBe(true);
      expect(isV8Serializable(new RangeError('range error'))).toBe(true);
    });

    it('should accept Buffer objects', () => {
      expect(isV8Serializable(Buffer.from('test'))).toBe(true);
      expect(isV8Serializable(Buffer.alloc(10))).toBe(true);
      expect(isV8Serializable(Buffer.from([1, 2, 3, 4]))).toBe(true);
    });

    it('should accept ArrayBuffer', () => {
      expect(isV8Serializable(new ArrayBuffer(8))).toBe(true);
    });

    it('should accept DataView', () => {
      const buffer = new ArrayBuffer(8);
      expect(isV8Serializable(new DataView(buffer))).toBe(true);
      expect(isV8Serializable(new DataView(buffer, 2, 4))).toBe(true);
    });

    it('should accept TypedArray instances', () => {
      expect(isV8Serializable(new Uint8Array([1, 2, 3]))).toBe(true);
      expect(isV8Serializable(new Int8Array([1, 2, 3]))).toBe(true);
      expect(isV8Serializable(new Uint16Array([1, 2, 3]))).toBe(true);
      expect(isV8Serializable(new Int16Array([1, 2, 3]))).toBe(true);
      expect(isV8Serializable(new Uint32Array([1, 2, 3]))).toBe(true);
      expect(isV8Serializable(new Int32Array([1, 2, 3]))).toBe(true);
      expect(isV8Serializable(new Float32Array([1.1, 2.2, 3.3]))).toBe(true);
      expect(isV8Serializable(new Float64Array([1.1, 2.2, 3.3]))).toBe(true);
      expect(isV8Serializable(new BigInt64Array([1n, 2n, 3n]))).toBe(true);
      expect(isV8Serializable(new BigUint64Array([1n, 2n, 3n]))).toBe(true);
      expect(isV8Serializable(new Uint8ClampedArray([0, 128, 255]))).toBe(true);
    });

    it('should accept Map with serializable keys and values', () => {
      expect(isV8Serializable(new Map())).toBe(true);
      expect(isV8Serializable(new Map([['key', 'value']]))).toBe(true);
      expect(
        isV8Serializable(
          new Map([
            [1, 'one'],
            [2, 'two']
          ])
        )
      ).toBe(true);
      expect(isV8Serializable(new Map([['nested', new Map([['inner', 'value']])]]))).toBe(true);
    });

    it('should accept Set with serializable values', () => {
      expect(isV8Serializable(new Set())).toBe(true);
      expect(isV8Serializable(new Set([1, 2, 3]))).toBe(true);
      expect(isV8Serializable(new Set(['a', 'b', 'c']))).toBe(true);
      expect(isV8Serializable(new Set([new Set([1, 2]), new Set([3, 4])]))).toBe(true);
    });

    it('should accept plain objects', () => {
      expect(isV8Serializable({})).toBe(true);
      expect(isV8Serializable({ key: 'value' })).toBe(true);
      expect(isV8Serializable({ nested: { deep: true } })).toBe(true);
    });

    it('should accept plain arrays', () => {
      expect(isV8Serializable([])).toBe(true);
      expect(isV8Serializable([1, 2, 3])).toBe(true);
      expect(isV8Serializable(['a', 'b', 'c'])).toBe(true);
      expect(isV8Serializable([{ nested: [1, 2, 3] }])).toBe(true);
    });

    it('should reject functions', () => {
      expect(isV8Serializable(() => {})).toBe(false);
      expect(isV8Serializable(function test() {})).toBe(false);
    });

    it('should reject symbols', () => {
      expect(isV8Serializable(Symbol('test'))).toBe(false);
    });

    it('should reject Map with non-serializable keys', () => {
      const map = new Map([[() => {}, 'value']]);
      expect(isV8Serializable(map)).toBe(false);
    });

    it('should reject Map with non-serializable values', () => {
      const map = new Map([['key', () => {}]]);
      expect(isV8Serializable(map)).toBe(false);
    });

    it('should reject Set with non-serializable values', () => {
      const set = new Set([1, 2, () => {}]);
      expect(isV8Serializable(set)).toBe(false);
    });

    it('should reject arrays with non-serializable elements', () => {
      expect(isV8Serializable([1, 2, () => {}])).toBe(false);
      expect(isV8Serializable([1, Symbol('test'), 3])).toBe(false);
    });

    it('should reject objects with non-serializable values', () => {
      expect(isV8Serializable({ fn: () => {} })).toBe(false);
      expect(isV8Serializable({ sym: Symbol('test') })).toBe(false);
    });

    it('should reject class instances (non-plain objects)', () => {
      class CustomClass {
        value = 42;
      }
      expect(isV8Serializable(new CustomClass())).toBe(false);
    });

    it('should accept objects with null prototype', () => {
      const obj = Object.create(null);
      obj.key = 'value';
      expect(isV8Serializable(obj)).toBe(true);
    });

    it('should handle complex nested structures', () => {
      const complex = {
        buffer: Buffer.from('test'),
        map: new Map([
          ['key1', new Set([1, 2, 3])],
          ['key2', new Uint8Array([1, 2, 3])]
        ]),
        bigint: BigInt(123),
        date: new Date(),
        regex: /test/,
        error: new Error('test'),
        nested: {
          array: [1, 2, 3],
          obj: { deep: true }
        }
      };
      expect(isV8Serializable(complex)).toBe(true);
    });
  });

  describe('validateV8Serializable', () => {
    it('should not throw for valid V8-serializable types', () => {
      expect(() => validateV8Serializable(42, 'test')).not.toThrow();
      expect(() => validateV8Serializable('string', 'test')).not.toThrow();
      expect(() => validateV8Serializable(BigInt(123), 'test')).not.toThrow();
      expect(() => validateV8Serializable(Buffer.from('test'), 'test')).not.toThrow();
      expect(() => validateV8Serializable(new Map(), 'test')).not.toThrow();
      expect(() => validateV8Serializable(new Set(), 'test')).not.toThrow();
      expect(() => validateV8Serializable(new Date(), 'test')).not.toThrow();
      expect(() => validateV8Serializable(/test/, 'test')).not.toThrow();
      expect(() => validateV8Serializable(new Error('test'), 'test')).not.toThrow();
    });

    it('should throw SerializationError for functions', () => {
      expect(() => validateV8Serializable(() => {}, 'test function')).toThrow(SerializationError);
    });

    it('should throw SerializationError for symbols', () => {
      expect(() => validateV8Serializable(Symbol('test'), 'test symbol')).toThrow(
        SerializationError
      );
    });

    it('should throw SerializationError for class instances', () => {
      class CustomClass {
        value = 42;
      }
      expect(() => validateV8Serializable(new CustomClass(), 'test instance')).toThrow(
        SerializationError
      );
    });

    it('should include context in error message', () => {
      try {
        validateV8Serializable(() => {}, 'constructor argument');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(SerializationError);
        expect((error as SerializationError).message).toContain('constructor argument');
      }
    });

    it('should include type name in error message', () => {
      try {
        validateV8Serializable(() => {}, 'test');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(SerializationError);
        // The error message includes details about the custom error in context
        const err = error as SerializationError;
        expect(err.context).toBeDefined();
        expect(err.context?.error).toContain('function');
        expect(err.context?.error).toContain('not V8-serializable');
      }
    });
  });

  describe('validateV8SerializableArray', () => {
    it('should not throw for empty array', () => {
      expect(() => validateV8SerializableArray([], 'test')).not.toThrow();
    });

    it('should not throw for array of valid V8-serializable values', () => {
      expect(() =>
        validateV8SerializableArray(
          [1, 'string', BigInt(123), Buffer.from('test'), new Map(), new Set(), new Date()],
          'test'
        )
      ).not.toThrow();
    });

    it('should throw SerializationError for array with function', () => {
      expect(() => validateV8SerializableArray([1, 2, () => {}], 'test array')).toThrow(
        SerializationError
      );
    });

    it('should throw SerializationError for array with symbol', () => {
      expect(() => validateV8SerializableArray([1, Symbol('test'), 3], 'test array')).toThrow(
        SerializationError
      );
    });

    it('should include index in error message', () => {
      try {
        validateV8SerializableArray([1, 2, () => {}, 4], 'method arguments');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(SerializationError);
        expect((error as SerializationError).message).toContain('[2]');
      }
    });

    it('should reject on first invalid element', () => {
      const arr = [() => {}, Symbol('test'), 3];

      try {
        validateV8SerializableArray(arr, 'test');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(SerializationError);
        expect((error as SerializationError).message).toContain('[0]');
      }
    });

    it('should handle complex valid arrays', () => {
      const arr = [
        Buffer.from('test'),
        new Map([['key', 'value']]),
        new Set([1, 2, 3]),
        BigInt(999),
        new Date(),
        /regex/,
        new Error('test'),
        new Uint8Array([1, 2, 3])
      ];
      expect(() => validateV8SerializableArray(arr, 'test')).not.toThrow();
    });
  });

  describe('V8 Serialization - Real-world scenarios', () => {
    it('should validate Buffer image data', () => {
      const imageData = Buffer.from([0xff, 0xd8, 0xff, 0xe0]); // JPEG header
      expect(isV8Serializable(imageData)).toBe(true);
    });

    it('should validate TypedArray for binary protocols', () => {
      const binaryData = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
      expect(isV8Serializable(binaryData)).toBe(true);
    });

    it('should validate Map for key-value caches', () => {
      const cache = new Map([
        ['user:1', { name: 'Alice', age: 30 }],
        ['user:2', { name: 'Bob', age: 25 }]
      ]);
      expect(isV8Serializable(cache)).toBe(true);
    });

    it('should validate Set for unique collections', () => {
      const uniqueIds = new Set([1, 2, 3, 4, 5]);
      expect(isV8Serializable(uniqueIds)).toBe(true);
    });

    it('should validate BigInt for large integers', () => {
      const timestamp = BigInt(Date.now()) * BigInt(1000000); // nanoseconds
      expect(isV8Serializable(timestamp)).toBe(true);
    });

    it('should validate complex data structures', () => {
      const complexData = {
        metadata: {
          timestamp: new Date(),
          version: '1.0.0'
        },
        payload: {
          binary: Buffer.from('data'),
          numbers: new Float64Array([1.1, 2.2, 3.3]),
          mapping: new Map([
            ['key1', new Set([1, 2, 3])],
            ['key2', { nested: true }]
          ]),
          bigNumber: BigInt('9007199254740992')
        },
        errors: [new Error('error1'), new Error('error2')]
      };
      expect(isV8Serializable(complexData)).toBe(true);
    });
  });
});
