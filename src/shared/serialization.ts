import type { Jsonifiable } from 'type-fest';
import { SerializationError } from './errors.js';

/**
 * JSON serialization validation utilities for Procxy.
 * Validates that values are JSON-serializable (Jsonifiable type) or callbacks.
 */

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
