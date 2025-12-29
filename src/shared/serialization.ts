import type { Jsonifiable } from 'type-fest';
import { SerializationError } from './errors.js';

/**
 * JSON serialization validation utilities for Procxy.
 * Validates that values are JSON-serializable (Jsonifiable type).
 */

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
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Validates that all values in an array are JSON-serializable.
 * Throws SerializationError on first non-serializable value.
 *
 * @param values - Array of values to validate
 * @param context - Description of where these values are from
 * @throws SerializationError if any value is not JSON-serializable
 */
export function validateJsonifiableArray(
  values: unknown[],
  context: string,
): asserts values is Jsonifiable[] {
  for (let i = 0; i < values.length; i++) {
    try {
      JSON.stringify(values[i]);
    } catch (error) {
      throw new SerializationError(values[i], `${context}[${i}]`, {
        error: error instanceof Error ? error.message : String(error),
        index: i,
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
      error: error instanceof Error ? error.message : String(error),
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
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
