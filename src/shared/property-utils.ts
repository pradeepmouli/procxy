/**
 * Shared utilities for property validation and filtering.
 */

/**
 * Check if a string is a valid JavaScript identifier.
 * Must start with a letter, underscore, or dollar sign,
 * followed by any combination of letters, digits, underscores, or dollar signs.
 */
export function isValidIdentifier(name: string): boolean {
  return /^[A-Za-z_$][\w$]*$/.test(name);
}

/**
 * Check if a property should be proxied/synced across IPC.
 *
 * A property is proxiable if:
 * - It has a valid JavaScript identifier name
 * - It doesn't start with '$' (reserved for procxy internal properties)
 * - It doesn't start with '_' (private/internal properties)
 * - Its value is not a function
 *
 * @param key - Property name
 * @param value - Property value
 * @returns true if the property should be proxied/synced
 */
export function isProxiableProperty(key: string, value: unknown): boolean {
  return (
    isValidIdentifier(key) &&
    !key.startsWith('$') &&
    !key.startsWith('_') &&
    typeof value !== 'function'
  );
}

/**
 * Check if an event name should be forwarded across IPC.
 *
 * An event is proxiable if:
 * - It doesn't start with '$' (reserved for procxy internal events)
 * - It doesn't start with '_' (private/internal events)
 *
 * @param eventName - Event name
 * @returns true if the event should be forwarded
 */
export function isProxiableEventName(eventName: string): boolean {
  return !eventName.startsWith('$') && !eventName.startsWith('_');
}
