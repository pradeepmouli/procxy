import type { Jsonifiable } from 'type-fest';
import { SerializationError } from './errors.js';

/**
 * JSON serialization validation utilities for Procxy.
 * Validates that values are JSON-serializable (Jsonifiable type) or callbacks.
 */

/**
 * Types that are serializable with V8 structured clone algorithm.
 * This includes all JSON-serializable types plus additional V8-specific types.
 */
export type V8Serializable =
  | Jsonifiable
  | Buffer
  | ArrayBuffer
  | Int8Array
  | Uint8Array
  | Uint8ClampedArray
  | Int16Array
  | Uint16Array
  | Int32Array
  | Uint32Array
  | Float32Array
  | Float64Array
  | BigInt64Array
  | BigUint64Array
  | Map<V8Serializable, V8Serializable>
  | Set<V8Serializable>
  | Error
  | RegExp
  | bigint
  | Date;

/**
 * Check if a value is V8-serializable.
 * V8 structured clone supports more types than JSON, including:
 * - Binary data: Buffer, ArrayBuffer, TypedArray
 * - Collections: Map, Set
 * - BigInt
 * - Date, RegExp, Error
 *
 * @param value - The value to check
 * @returns true if the value can be serialized with V8 structured clone
 */
export function isV8Serializable(value: unknown): value is V8Serializable {
  if (value === null || value === undefined) return true;

  const type = typeof value;

  // Primitive types (including NaN and Infinity for numbers)
  if (type === 'string' || type === 'number' || type === 'boolean' || type === 'bigint') {
    return true;
  }

  // Functions are not serializable
  if (type === 'function') return false;

  // Symbols are not serializable
  if (type === 'symbol') return false;

  // Check for specific object types
  if (typeof value === 'object') {
    // Date
    if (value instanceof Date) return true;

    // RegExp
    if (value instanceof RegExp) return true;

    // Error
    if (value instanceof Error) return true;

    // Buffer (Node.js specific)
    if (Buffer.isBuffer(value)) return true;

    // ArrayBuffer
    if (value instanceof ArrayBuffer) return true;

    // TypedArray
    if (ArrayBuffer.isView(value)) return true;

    // Map
    if (value instanceof Map) {
      for (const [k, v] of value.entries()) {
        if (!isV8Serializable(k) || !isV8Serializable(v)) return false;
      }
      return true;
    }

    // Set
    if (value instanceof Set) {
      for (const item of value.values()) {
        if (!isV8Serializable(item)) return false;
      }
      return true;
    }

    // Plain arrays
    if (Array.isArray(value)) {
      return value.every((item) => isV8Serializable(item));
    }

    // Plain objects
    if (
      Object.getPrototypeOf(value) === Object.prototype ||
      Object.getPrototypeOf(value) === null
    ) {
      return Object.values(value).every((v) => isV8Serializable(v));
    }

    // Other object types are not supported
    return false;
  }

  return false;
}

/**
 * Validates that a value is V8-serializable.
 * Throws SerializationError if validation fails.
 *
 * @param value - The value to validate
 * @param context - Description of where this value is from
 * @throws SerializationError if value is not V8-serializable
 */
export function validateV8Serializable(
  value: unknown,
  context: string
): asserts value is V8Serializable {
  if (!isV8Serializable(value)) {
    const type = typeof value;
    const typeName =
      type === 'object' && value !== null && value !== undefined
        ? value.constructor?.name || 'Object'
        : type;

    throw new SerializationError(value, context, {
      error: `Value of type '${typeName}' is not V8-serializable. Supported types include primitives, Buffer, TypedArray, Map, Set, BigInt, Date, RegExp, Error, and plain objects/arrays.`
    });
  }
}

/**
 * Validates that all values in an array are V8-serializable.
 *
 * @param values - Array of values to validate
 * @param context - Description of where these values are from
 * @throws SerializationError if any value is not V8-serializable
 */
export function validateV8SerializableArray(
  values: unknown[],
  context: string
): asserts values is V8Serializable[] {
  for (let i = 0; i < values.length; i++) {
    try {
      validateV8Serializable(values[i], `${context}[${i}]`);
    } catch (error) {
      if (error instanceof SerializationError) {
        throw error;
      }
      throw new SerializationError(values[i], `${context}[${i}]`, {
        error: error instanceof Error ? error.message : String(error),
        index: i
      });
    }
  }
}

/**
 * Marker interface for serialized callbacks.
 */
export interface SerializedCallback {
  __callbackId: string;
  __isCallback: true;
}

/**
 * Type guard to check if a value is a serialized callback.
 */
export function isSerializedCallback(value: unknown): value is SerializedCallback {
  return (
    typeof value === 'object' &&
    value !== null &&
    '__callbackId' in value &&
    '__isCallback' in value &&
    (value as SerializedCallback).__isCallback === true
  );
}

/**
 * Callback registry for managing function references.
 */
export class CallbackRegistry {
  private callbacks = new Map<string, Function>();
  private nextId = 0;

  /**
   * Register a callback and return its ID.
   */
  register(callback: Function): string {
    const id = `cb_${this.nextId++}_${Date.now()}`;
    this.callbacks.set(id, callback);
    return id;
  }

  /**
   * Get a callback by ID.
   */
  get(id: string): Function | undefined {
    return this.callbacks.get(id);
  }

  /**
   * Unregister a callback by ID.
   */
  unregister(id: string): void {
    this.callbacks.delete(id);
  }

  /**
   * Clear all callbacks.
   */
  clear(): void {
    this.callbacks.clear();
  }
}

/**
 * Serialize a value, converting callbacks to callback IDs.
 */
export function serializeWithCallbacks(
  value: unknown,
  callbackRegistry: CallbackRegistry
): Jsonifiable {
  if (typeof value === 'function') {
    const callbackId = callbackRegistry.register(value);
    return { __callbackId: callbackId, __isCallback: true } as any;
  }

  if (Array.isArray(value)) {
    return value.map((item) => serializeWithCallbacks(item, callbackRegistry)) as any;
  }

  if (value && typeof value === 'object' && !(value instanceof Date)) {
    const result: any = {};
    for (const [key, val] of Object.entries(value)) {
      result[key] = serializeWithCallbacks(val, callbackRegistry);
    }
    return result;
  }

  return value as Jsonifiable;
}

/**
 * Validates that a value is JSON-serializable by attempting JSON.stringify().
 * Throws SerializationError if validation fails.
 *
 * @param value - The value to validate
 * @param context - Description of where this value is from (e.g., "constructor argument", "method argument")
 * @throws SerializationError if value is not JSON-serializable
 */
export function validateJsonifiable(value: unknown, context: string): asserts value is Jsonifiable {
  try {
    JSON.stringify(value);
  } catch (error) {
    throw new SerializationError(value, context, {
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * Validates that all values in an array are JSON-serializable or callbacks.
 * Callbacks are allowed and will be proxied.
 *
 * @param values - Array of values to validate
 * @param context - Description of where these values are from
 * @param callbackRegistry - Optional registry to serialize callbacks
 * @throws SerializationError if any value is not JSON-serializable and not a function
 */
export function validateJsonifiableArray(
  values: unknown[],
  context: string,
  callbackRegistry?: CallbackRegistry
): asserts values is Jsonifiable[] {
  for (let i = 0; i < values.length; i++) {
    // Allow functions if we have a callback registry
    if (typeof values[i] === 'function') {
      if (!callbackRegistry) {
        throw new SerializationError(values[i], `${context}[${i}]`, {
          error:
            'Functions are not JSON-serializable. Callback support not available in this context.',
          index: i
        });
      }
      continue; // Valid - will be serialized as callback
    }

    try {
      JSON.stringify(values[i]);
    } catch (error) {
      throw new SerializationError(values[i], `${context}[${i}]`, {
        error: error instanceof Error ? error.message : String(error),
        index: i
      });
    }
  }
}

/**
 * Serializes a value to JSON string, with proper error handling.
 * Used for IPC message payloads.
 *
 * @param value - Value to serialize
 * @param context - Description for error messages
 * @returns JSON string representation
 * @throws SerializationError if value is not JSON-serializable
 */
export function serializeToJson(value: Jsonifiable, context: string): string {
  try {
    return JSON.stringify(value);
  } catch (error) {
    throw new SerializationError(value, context, {
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * Deserializes a JSON string, with proper error handling.
 * Used for IPC message payloads.
 *
 * @param json - JSON string to deserialize
 * @param context - Description for error messages
 * @returns Parsed JSON value
 * @throws SerializationError if JSON is malformed
 */
export function deserializeFromJson(json: string, context: string): Jsonifiable {
  try {
    return JSON.parse(json) as Jsonifiable;
  } catch (error) {
    throw new SerializationError(json, context, {
      error: error instanceof Error ? error.message : String(error)
    });
  }
}
