/**
 * Create a lazy-initialized debug logger.
 * Uses the `debug` package if available, falls back to env-var gated console.warn, or no-ops.
 *
 * @param channel - Debug channel name (e.g. 'procxy:resolver')
 * @param envVar - Environment variable that enables fallback logging when set to '1'
 */
export function createDebugLogger(channel: string, envVar: string): () => (msg: string) => void {
  let cached: ((msg: string) => void) | null = null;

  return () => {
    if (cached) return cached;

    try {
      const createDebug = require('debug');
      cached = createDebug(channel);
    } catch {
      if (process.env[envVar] === '1') {
        cached = (msg: string) => console.warn(`[${channel}] ${msg}`);
      } else {
        cached = () => {};
      }
    }

    return cached!;
  };
}
