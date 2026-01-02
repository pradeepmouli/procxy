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
  | DataView
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
  | Map<any, any>
  | Set<any>
  | Error
  | RegExp
  | bigint
  | Date
  | { [key: string]: V8Serializable | undefined }
  | ReadonlyArray<V8Serializable>;

/**
 * Check if a value is V8-serializable.
 * V8 structured clone supports more types than JSON, including:
 * - Binary data: Buffer, ArrayBuffer, DataView, TypedArray
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
    const proto = Object.getPrototypeOf(value);
    if (proto === Object.prototype || proto === null) {
      // Check all properties, including getters/setters
      for (const key of Object.getOwnPropertyNames(value)) {
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (!descriptor) continue;

        // Check if property has getters/setters (these are functions, not serializable)
        if (descriptor.get || descriptor.set) {
          return false;
        }

        // Check the value
        if (!isV8Serializable(descriptor.value)) {
          return false;
        }
      }

      // Also check symbol properties
      for (const symbol of Object.getOwnPropertySymbols(value)) {
        const descriptor = Object.getOwnPropertyDescriptor(value, symbol);
        if (descriptor && !isV8Serializable(descriptor.value)) {
          return false;
        }
      }

      return true;
    }

    // Other object types are not supported
    return false;
  }

  return false;
}

/**
 * Find the first non-serializable property in an object (for debugging).
 */
function findNonSerializableProperty(value: unknown): { path: string; reason: string } | null {
  const visited = new WeakSet<object>();

  function check(obj: unknown, path: string): { path: string; reason: string } | null {
    if (obj === null || obj === undefined || typeof obj !== 'object') {
      return null;
    }

    if (visited.has(obj as object)) {
      return null; // Already checked (prevent infinite recursion)
    }
    visited.add(obj as object);

    // Check for functions
    if (typeof obj === 'function') {
      return { path, reason: 'value is a function' };
    }

    // For plain objects, recursively check properties
    const proto = Object.getPrototypeOf(obj);
    if (proto === Object.prototype || proto === null) {
      for (const key of Object.getOwnPropertyNames(obj)) {
        const descriptor = Object.getOwnPropertyDescriptor(obj, key);
        if (!descriptor) continue;

        if (descriptor.get || descriptor.set) {
          return { path: path ? `${path}.${key}` : key, reason: 'property has getter/setter' };
        }

        if (descriptor.value !== undefined && typeof descriptor.value === 'function') {
          return { path: path ? `${path}.${key}` : key, reason: 'property is a function' };
        }

        const result = check(descriptor.value, path ? `${path}.${key}` : key);
        if (result) return result;
      }
    } else if (Array.isArray(obj)) {
      for (let i = 0; i < obj.length; i++) {
        const result = check(obj[i], `${path}[${i}]`);
        if (result) return result;
      }
    } else if (
      !(
        obj instanceof Date ||
        obj instanceof RegExp ||
        obj instanceof Error ||
        Buffer?.isBuffer(obj) ||
        obj instanceof ArrayBuffer ||
        ArrayBuffer.isView(obj) ||
        obj instanceof Map ||
        obj instanceof Set
      )
    ) {
      // Check if it's a class instance (not a known serializable type)
      const typeName = obj.constructor?.name || 'Object';
      if (typeName !== 'Object') {
        return { path, reason: `instance of ${typeName} class` };
      }
    }

    return null;
  }

  return check(value, '');
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

    const nonSerializable = findNonSerializableProperty(value);
    const detailMessage = nonSerializable
      ? ` (property '${nonSerializable.path}' is ${nonSerializable.reason})`
      : '';

    throw new SerializationError(value, context, {
      error: `Value of type '${typeName}' is not V8-serializable. Supported types include primitives, Buffer, ArrayBuffer, DataView, TypedArray, Map, Set, BigInt, Date, RegExp, Error, and plain objects/arrays.${detailMessage}`
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
 * Sanitize a value by converting to plain objects and removing non-V8-serializable properties.
 * Recursively processes objects, arrays, and nested structures.
 *
 * This is useful for configuration objects that may contain functions,
 * class instances, or other non-serializable properties that aren't needed in the child process.
 *
 * @param value - The value to sanitize
 * @returns A new value with all non-serializable properties removed
 *
 * @example
 * ```typescript
 * const config = {
 *   data: 'hello',
 *   handler: () => {},  // Will be removed
 *   nested: {
 *     value: 42,
 *     method: () => {}  // Will be removed
 *   }
 * };
 *
 * const sanitized = sanitizeForV8(config);
 * // Result: { data: 'hello', nested: { value: 42 } }
 * ```
 */
export function sanitizeForV8(value: unknown, seen: WeakSet<object> = new WeakSet()): any {
  const sanitize = (val: unknown): any => {
    if (val === null || typeof val !== 'object') {
      return val;
    }

    // Circular reference guard
    if (seen.has(val as object)) {
      return '[Circular]';
    }
    seen.add(val as object);

    // Handle Date, RegExp, Error as-is
    if (
      val instanceof Date ||
      val instanceof RegExp ||
      val instanceof Error ||
      Buffer.isBuffer(val) ||
      val instanceof ArrayBuffer ||
      ArrayBuffer.isView(val)
    ) {
      return val;
    }

    // Map - recursively sanitize keys and values
    if (val instanceof Map) {
      const sanitized = new Map();
      for (const [k, v] of val.entries()) {
        sanitized.set(sanitize(k), sanitize(v));
      }
      return sanitized;
    }

    // Set - recursively sanitize elements
    if (val instanceof Set) {
      const sanitized = new Set();
      for (const item of val.values()) {
        sanitized.add(sanitize(item));
      }
      return sanitized;
    }

    // Arrays - recursively sanitize elements
    if (Array.isArray(val)) {
      return val.map((item) => sanitize(item));
    }

    // Plain objects - convert to plain object and recursively sanitize
    // Filter out functions and recursively process values
    return Object.fromEntries(
      Object.entries(val)
        .filter(([, v]) => typeof v !== 'function')
        .map(([k, v]) => [k, sanitize(v)])
    );
  };

  return sanitize(value);
}

/**
 * Sanitize an array of values by removing non-V8-serializable properties from each.
 *
 * @param values - Array of values to sanitize
 * @returns New array with sanitized values
 *
 * @example
 * ```typescript
 * const args = [
 *   { config: true, handler: () => {} },
 *   { value: 42 }
 * ];
 * const sanitized = sanitizeForV8Array(args);
 * // Result: [{ config: true }, { value: 42 }]
 * ```
 */
export function sanitizeForV8Array(
  values: unknown[],
  seen: WeakSet<object> = new WeakSet()
): any[] {
  return values.map((v) => sanitizeForV8(v, seen));
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
 * In advanced serialization mode, special types (Buffer, Map, Set, etc.) are preserved.
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

  // Preserve V8-serializable types - don't destructure them
  // These types will be handled by Node.js's V8 serialization when serialization: 'advanced'
  if (value && typeof value === 'object') {
    // Date - preserve as-is
    if (value instanceof Date) {
      return value as any;
    }

    // Buffer - preserve as-is (Node.js specific)
    if (Buffer.isBuffer(value)) {
      return value as any;
    }

    // TypedArray - preserve as-is
    if (ArrayBuffer.isView(value)) {
      return value as any;
    }

    // Map - preserve as-is
    if (value instanceof Map) {
      return value as any;
    }

    // Set - preserve as-is
    if (value instanceof Set) {
      return value as any;
    }

    // ArrayBuffer - preserve as-is
    if (value instanceof ArrayBuffer) {
      return value as any;
    }

    // RegExp - preserve as-is
    if (value instanceof RegExp) {
      return value as any;
    }

    // Error - preserve as-is
    if (value instanceof Error) {
      return value as any;
    }

    // BigInt is a primitive, handled below

    // Plain objects - recursively serialize
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
