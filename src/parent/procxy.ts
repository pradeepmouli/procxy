import { fork, type ForkOptions } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Constructor, Jsonifiable } from 'type-fest';
import type { Procxy, SerializableConstructorArgs } from '../types/procxy.js';
import type { ProcxyOptions } from '../types/options.js';
import { resolveConstructorModule } from '../shared/module-resolver.js';
import {
  validateJsonifiableArray,
  validateV8SerializableArray,
  sanitizeForV8Array
} from '../shared/serialization.js';
import { createParentProxy } from './parent-proxy.js';
import { IPCClient } from './ipc-client.js';
import { ChildCrashedError, OptionsValidationError, TimeoutError } from '../shared/errors.js';
import type { InitMessage } from '../shared/protocol.js';
import { makeDedupKey } from './dedup-utils.js';
import { createDebugLogger } from '../shared/debug.js';

const DEFAULT_TIMEOUT_MS = 30000;
const DEFAULT_RETRIES = 3;
const MIN_INIT_TIMEOUT_MS = 1000;
const MAX_CACHE_SIZE = 100;

/**
 * Deduplication cache: tracks in-flight Procxy creations to avoid duplicate child spawning.
 * Key format: "ClassName:modulePath:optionsHash:argsHash"
 * Value: Promise that resolves to the initialized Procxy proxy
 */
const inFlightDedup = new Map<string, Promise<unknown>>();

/**
 * Result cache: stores successfully created Procxy instances for reuse on sequential calls.
 * Key format: "ClassName:modulePath:optionsHash:argsHash"
 * Value: The resolved Procxy proxy instance
 */
const resultCache = new Map<string, unknown>();

/**
 * Cache eviction: track insertion order for LRU eviction
 */
const cacheInsertionOrder: string[] = [];

/**
 * Evict oldest entry from result cache when it exceeds MAX_CACHE_SIZE
 */
function evictOldestCacheEntry(): void {
  if (cacheInsertionOrder.length > 0) {
    const oldestKey = cacheInsertionOrder.shift()!;
    resultCache.delete(oldestKey);
    getDebugLogger()(`cache evicted: ${oldestKey}`);
  }
}

const getDebugLogger = createDebugLogger('procxy:dedup', 'PROCXY_DEBUG_DEDUP');

/**
 * Check if an object is likely a ProcxyOptions object.
 * This checks for known ProcxyOptions properties to distinguish from plain constructor arguments.
 */
function isProcxyOptions(obj: unknown): obj is ProcxyOptions {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return false;
  }

  const knownKeys = [
    'modulePath',
    'timeout',
    'retries',
    'serialization',
    'env',
    'cwd',
    'args',
    'supportHandles',
    'interleaveOutput',
    'sanitizeV8'
  ];

  // Check if the object has at least one known ProcxyOptions property
  return knownKeys.some((key) => key in obj);
}

function validateOptions<M extends 'json' | 'advanced', SH extends boolean = false>(
  options: ProcxyOptions<M, SH>
): void {
  if (
    options.timeout !== undefined &&
    (typeof options.timeout !== 'number' || options.timeout <= 0)
  ) {
    throw new OptionsValidationError('timeout', options.timeout, 'must be a positive number');
  }

  if (
    options.retries !== undefined &&
    (typeof options.retries !== 'number' || options.retries < 0)
  ) {
    throw new OptionsValidationError('retries', options.retries, 'must be a non-negative number');
  }

  if (options.env) {
    for (const [key, value] of Object.entries(options.env)) {
      if (typeof value !== 'string') {
        throw new OptionsValidationError(
          `env.${key}`,
          value,
          'environment variables must be strings'
        );
      }
    }
  }

  if (options.args) {
    if (options.serialization === 'json' || options.serialization === undefined) {
      validateJsonifiableArray(options.args as unknown[], 'ProcxyOptions.args');
    } else {
      validateV8SerializableArray(options.args as unknown[], 'ProcxyOptions.args');
    }
  }

  if (options.cwd) {
    if (!existsSync(options.cwd) || !statSync(options.cwd).isDirectory()) {
      throw new OptionsValidationError('cwd', options.cwd, 'must be an existing directory');
    }
  }

  if (options.serialization !== undefined) {
    if (options.serialization !== 'json' && options.serialization !== 'advanced') {
      throw new OptionsValidationError(
        'serialization',
        options.serialization,
        'must be either "json" or "advanced"'
      );
    }
  }
}

function pickAgentPath(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const built = resolve(currentDir, '../child/agent.js');
  if (existsSync(built)) {
    return built;
  }
  return resolve(currentDir, '../child/agent.ts');
}

const requireFromHere = createRequire(import.meta.url);

function pickExecArgv(agentPath: string, targetModulePath: string): string[] {
  // Use tsx if either the agent or target module is TypeScript
  // Check for .ts file on disk (since module resolver returns .js paths for ESM compatibility)
  const targetIsTsx =
    targetModulePath.endsWith('.ts') || existsSync(targetModulePath.replace(/\.js$/, '.ts'));
  const needsTsx = agentPath.endsWith('.ts') || targetIsTsx;

  if (!needsTsx) return [];

  // Resolve tsx loader absolutely so custom cwd values do not break resolution
  const tsxImportPath = requireFromHere.resolve('tsx/esm');
  return ['--import', tsxImportPath];
}

function toArgStrings(args: Jsonifiable[] | undefined): string[] {
  if (!args) return [];
  return args.map((arg) => (typeof arg === 'string' ? arg : JSON.stringify(arg)));
}

async function waitForInitialization(ipcClient: IPCClient, timeoutMs: number): Promise<void> {
  const effectiveTimeout = Math.max(timeoutMs, MIN_INIT_TIMEOUT_MS);

  return new Promise((resolveInit, rejectInit) => {
    const onSuccess = (): void => {
      cleanup();
      resolveInit();
    };

    const onFailure = (error: Error): void => {
      cleanup();
      rejectInit(error);
    };

    const onExit = (code: number | null, signal: NodeJS.Signals | null): void => {
      cleanup();
      rejectInit(new ChildCrashedError(code, signal));
    };

    const timer = setTimeout(() => {
      cleanup();
      rejectInit(new TimeoutError('init', effectiveTimeout));
    }, effectiveTimeout);

    const cleanup = (): void => {
      clearTimeout(timer);
      ipcClient.off('init_success', onSuccess);
      ipcClient.off('init_failure', onFailure);
      ipcClient.off('child_exit', onExit);
    };

    ipcClient.once('init_success', onSuccess);
    ipcClient.once('init_failure', onFailure);
    ipcClient.once('child_exit', onExit);
  });
}

/**
 * Spawn a class instance in an isolated child process and return a transparent async proxy.
 *
 * @remarks
 * Uses Node.js `child_process.fork()` to create a dedicated process for the class instance.
 * All method calls on the returned proxy are serialized, forwarded over IPC, and the result
 * is sent back — adding roughly 1 ms round-trip overhead per call. The same call signature
 * is supported in five forms: with/without a module path string, with/without options, and
 * with/without constructor arguments. Concurrent calls to `procxy()` with identical arguments
 * are deduplicated: only one child is spawned and subsequent callers receive the same proxy.
 * Completed proxies are cached with LRU eviction (max 100 entries) so sequential calls also
 * skip re-spawning, until the child process terminates.
 *
 * @param classOrClassName - The class constructor, or a string class name when using the module-map overload, whose instance will run in the child process
 * @param modulePathOrOptions - Path to the module file that exports the class, or a {@link ProcxyOptions} object when omitting a separate path
 * @param options - {@link ProcxyOptions} when the second argument is a module path string
 * @param constructorArgs - Arguments forwarded to the class constructor; must be JSON-serializable in `'json'` mode or V8-serializable in `'advanced'` mode
 * @returns A `Procxy<T>` proxy whose methods are all async and whose read-only properties mirror the child instance
 *
 * @throws {OptionsValidationError} When `timeout`, `retries`, `env`, or `cwd` in options fail validation
 * @throws {ModuleResolutionError} When no module path is provided and automatic stack-trace detection cannot locate the class's file
 * @throws {SerializationError} When any constructor argument cannot be serialized under the active mode
 * @throws {ChildCrashedError} When the child process exits before the INIT handshake completes
 * @throws {TimeoutError} When the INIT handshake does not complete within the configured `timeout`
 *
 * @useWhen
 * - You need CPU-intensive work (parsing, compression, ML inference, image processing) isolated from the main event loop
 * - You want EventEmitter events from a worker class forwarded transparently to the parent process
 * - You need to sandbox third-party code so a crash in the library cannot take down the parent
 * - You have a class with complex stateful initialization and want to reuse one instance across multiple callers (dedup cache)
 * - You need to run the same class concurrently across multiple isolated processes without managing fork logic yourself
 *
 * @avoidWhen
 * - Your class holds non-serializable state: closures captured over parent-side objects, WeakMaps, Symbols, or live streams — they do not survive the IPC boundary
 * - Sub-millisecond latency is required; IPC adds ~1 ms per round-trip even for trivial calls
 * - Your method return values include class instances with behavior — they are serialized to plain data and arrive without prototype methods
 * - You need the child to call back into parent-side callbacks synchronously inside a proxied method (deadlock risk)
 *
 * @pitfalls
 * - NEVER pass functions as constructor arguments — V8 serialization silently drops them; use `sanitizeV8: true` only as a last resort and accept the data loss
 * - NEVER call `$terminate()` from inside a proxied method's implementation in the child — the IPC response for the current call is never sent, hanging the parent indefinitely
 * - NEVER assume the cached proxy is always fresh — if the child crashes and you hold a reference, subsequent calls throw `ChildCrashedError`; check `$process.exitCode` before reusing across request boundaries
 * - NEVER mix `'json'` and `'advanced'` mode on the same class across different `procxy()` calls — they produce separate child processes with separate dedup keys; use one mode consistently
 * - NEVER set `retries` to a high value for non-idempotent methods — each retry re-sends the full IPC call; the method may execute multiple times if the child is slow but alive
 *
 * @example
 * ```typescript
 * // Basic usage — automatic module path detection
 * import { procxy } from 'procxy';
 * import { Calculator } from './calculator.js';
 *
 * await using calc = await procxy(Calculator);
 * const result = await calc.add(5, 7); // 12
 * // Child terminates automatically when the block exits
 * ```
 *
 * @example
 * ```typescript
 * // CPU-intensive worker with constructor args and custom options
 * import { procxy } from 'procxy';
 * import { ImageProcessor } from './image-processor.js';
 *
 * const processor = await procxy(
 *   ImageProcessor,
 *   './image-processor.js',
 *   { timeout: 60_000, retries: 1, serialization: 'advanced' } as const,
 *   { quality: 80, format: 'webp' }  // constructor arg — plain object, no functions
 * );
 *
 * const thumbnail = await processor.resize(imageBuffer, 200, 200);
 * await processor.$terminate();
 * ```
 *
 * @example
 * ```typescript
 * // EventEmitter forwarding
 * import { procxy } from 'procxy';
 * import { LogWatcher } from './log-watcher.js';
 *
 * const watcher = await procxy(LogWatcher, './log-watcher.js');
 * watcher.on('line', (text: string) => console.log('[child]', text));
 * await watcher.start('/var/log/syslog');
 * // Lines emitted by the child arrive here via IPC event bridge
 * ```
 *
 * @category Core
 * @see {@link Procxy} — proxy type returned by this function
 * @see {@link ProcxyOptions} — full configuration reference
 */
export async function procxy<
  T extends Record<string, typeof Object>,
  C extends keyof T,
  M extends 'advanced' | 'json',
  SH extends boolean = false
>(
  className: keyof T,
  modulePathOrOptions?: string | ProcxyOptions<M, SH>,
  options?: ProcxyOptions<M, SH>,
  ...constructorArgs: T[keyof T] extends Constructor<any>
    ? SerializableConstructorArgs<T[keyof T], M>
    : never
): Promise<T[C] extends Constructor<infer U> ? Procxy<U, M, SH> : never>;
export async function procxy<
  T extends object,
  M extends 'advanced' | 'json',
  SH extends boolean = false
>(
  Class: Constructor<T>,
  modulePath: string,
  options: ProcxyOptions<M, SH>,
  ...constructorArgs: SerializableConstructorArgs<T, M>
): Promise<Procxy<T, M, SH>>;
export async function procxy<
  T extends object,
  M extends 'advanced' | 'json',
  SH extends boolean = false
>(
  Class: Constructor<T>,
  options: ProcxyOptions<M, SH>,
  ...constructorArgs: SerializableConstructorArgs<T, M>
): Promise<Procxy<T, M, SH>>;
export async function procxy<
  T extends object,
  M extends 'advanced' | 'json',
  SH extends boolean = false
>(
  Class: Constructor<T>,
  modulePath: string,
  ...constructorArgs: SerializableConstructorArgs<T, M>
): Promise<Procxy<T, M, SH>>;
export async function procxy<
  T extends object,
  M extends 'advanced' | 'json',
  SH extends boolean = false
>(
  Class: Constructor<T>,
  ...constructorArgs: SerializableConstructorArgs<T, M>
): Promise<Procxy<T, M, SH>>;

export async function procxy<
  T extends object | Record<string, typeof Object>,
  C extends keyof T,
  M extends 'advanced' | 'json',
  SH extends boolean = false
>(
  classOrClassName: T extends object ? Constructor<T> : C,
  modulePathOrOptions?: string | ProcxyOptions<M, SH>,
  options?: ProcxyOptions<M, SH>,
  ...constructorArgs: T extends object
    ? ConstructorParameters<Constructor<T>>
    : T[C] extends Constructor<any>
      ? ConstructorParameters<T[C]>
      : never
): Promise<
  T extends object ? Procxy<T, M, SH> : T[C] extends Constructor<infer U> ? Procxy<U, M, SH> : never
> {
  // Parse arguments to handle all permutations:
  // 1. procxy(Class|className, modulePath, options, ...args)
  // 2.1. procxy(Class, options, ...args) - options.modulePath optional
  // 2.2. procxy(className, options, ...args) - options.modulePath mandatory
  // 3. procxy(Class|className, modulePath, ...args) - no options
  // 4. procxy(Class, ...args) - no modulePath or options (Class only)

  let modulePath: string | undefined;
  let resolvedOptions: ProcxyOptions<M, SH> | undefined;
  let actualConstructorArgs: any[];

  if (typeof modulePathOrOptions === 'string') {
    // modulePathOrOptions is a modulePath string
    modulePath = modulePathOrOptions;

    if (isProcxyOptions(options)) {
      // Case: procxy(Class, modulePath, options, ...args)
      resolvedOptions = options;
      actualConstructorArgs = constructorArgs;
    } else {
      // Case: procxy(Class, modulePath, ...args) - options is actually first constructor arg
      resolvedOptions = undefined;
      actualConstructorArgs =
        options !== undefined ? [options, ...constructorArgs] : constructorArgs;
    }
  } else if (isProcxyOptions(modulePathOrOptions)) {
    // modulePathOrOptions is options object
    resolvedOptions = modulePathOrOptions as ProcxyOptions<M, SH>;
    modulePath = resolvedOptions.modulePath;

    // Case: procxy(Class, options, ...args)
    // options param becomes first constructor arg
    actualConstructorArgs = options !== undefined ? [options, ...constructorArgs] : constructorArgs;
  } else {
    // Case: procxy(Class, ...args) - no modulePath or options
    modulePath = undefined;
    resolvedOptions = undefined;
    actualConstructorArgs =
      modulePathOrOptions !== undefined
        ? [modulePathOrOptions, ...(options !== undefined ? [options] : []), ...constructorArgs]
        : constructorArgs;
  }

  validateOptions(resolvedOptions ?? ({} as ProcxyOptions<M, SH>));

  const serializationMode = resolvedOptions?.serialization ?? 'json';

  // Validate constructor args based on serialization mode
  if (serializationMode === 'json') {
    validateJsonifiableArray(actualConstructorArgs, 'constructor arguments');
  } else if (resolvedOptions?.serialization === 'advanced') {
    // Lazy sanitization: only sanitize if validation fails
    if (resolvedOptions.sanitizeV8) {
      try {
        validateV8SerializableArray(actualConstructorArgs, 'constructor arguments');
      } catch {
        // Validation failed - sanitize to strip non-serializable content
        actualConstructorArgs = sanitizeForV8Array(actualConstructorArgs);
      }
    } else {
      validateV8SerializableArray(actualConstructorArgs, 'constructor arguments');
    }

    const supportHandles = resolvedOptions?.supportHandles ?? false;

    // Warn if handle passing is requested on Windows
    if (supportHandles && process.platform === 'win32') {
      console.warn(
        '[procxy] Warning: Handle passing has limited support on Windows. ' +
          'Some features may not work correctly.'
      );
    }
  }

  const moduleResolution = resolveConstructorModule(
    classOrClassName as unknown as Function,
    typeof classOrClassName === 'string'
      ? classOrClassName
      : (classOrClassName as Constructor<T>).name,
    modulePath
  );

  const resolvedModulePath = moduleResolution.modulePath.startsWith('file://')
    ? fileURLToPath(moduleResolution.modulePath)
    : resolve(moduleResolution.modulePath);

  // Create deduplication key including constructor args and isolation-affecting options
  const dedupKey = makeDedupKey(
    moduleResolution.className,
    resolvedModulePath,
    actualConstructorArgs,
    resolvedOptions as ProcxyOptions | undefined
  );
  const debug = getDebugLogger();

  // Check result cache first (for sequential calls after completion)
  if (resultCache.has(dedupKey)) {
    const cached = resultCache.get(dedupKey) as any;

    // If the cached proxy exposes lifecycle information, ensure it is still alive.
    // Parent proxies intentionally reserve unknown "$*" members, so probing internal
    // lifecycle helpers (e.g. $isTerminated) throws. Use $process state instead.
    let isTerminated = false;
    try {
      const cachedProcess = cached && (cached as any).$process;
      if (cachedProcess && typeof cachedProcess === 'object') {
        isTerminated =
          cachedProcess.killed === true ||
          cachedProcess.connected === false ||
          cachedProcess.exitCode !== null ||
          cachedProcess.signalCode !== null;
      }
    } catch {
      // If lifecycle probe fails, treat as terminated to avoid reusing stale proxies.
      isTerminated = true;
    }

    if (isTerminated) {
      debug(`dedup cached (stale, evicting): ${dedupKey}`);
      resultCache.delete(dedupKey);
      const idx = cacheInsertionOrder.indexOf(dedupKey);
      if (idx !== -1) {
        cacheInsertionOrder.splice(idx, 1);
      }
    } else if (cached) {
      debug(`dedup cached: ${dedupKey}`);
      return cached;
    }
  }

  // Check in-flight cache (for concurrent calls)
  if (inFlightDedup.has(dedupKey)) {
    debug(`dedup hit: ${dedupKey}`);
    return inFlightDedup.get(dedupKey) as any;
  }

  debug(`dedup miss: ${dedupKey}`);

  const timeout = resolvedOptions?.timeout ?? DEFAULT_TIMEOUT_MS;
  const retries = resolvedOptions?.retries ?? DEFAULT_RETRIES;

  const agentPath = pickAgentPath();
  const execArgv = pickExecArgv(agentPath, resolvedModulePath);

  const forkOptions: ForkOptions = {
    stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
    cwd: resolvedOptions?.cwd ?? process.cwd(),
    env: { ...process.env, ...resolvedOptions?.env },
    execArgv,
    serialization: serializationMode
  };

  // Create the promise and store it in inFlightDedup BEFORE spawning the child
  // This prevents race conditions where concurrent calls miss the in-flight entry
  const dedupPromise = (async () => {
    try {
      const child = fork(agentPath, toArgStrings(resolvedOptions?.args), forkOptions);

      const ipcClient = new IPCClient(child, timeout, retries);

      // Set up output forwarding if requested
      if (resolvedOptions?.interleaveOutput) {
        if (child.stdout) {
          child.stdout.pipe(process.stdout);
        }
        if (child.stderr) {
          child.stderr.pipe(process.stderr);
        }
      }

      const initMessage: InitMessage = {
        type: 'INIT',
        modulePath: resolvedModulePath,
        className: moduleResolution.className,
        constructorArgs: [...actualConstructorArgs],
        serialization: serializationMode
      };

      child.send(initMessage);
      await waitForInitialization(ipcClient, timeout);

      // Cast through any to work around TypeScript's conditional type narrowing limitations
      const proxy = createParentProxy(ipcClient) as any;

      // Success: cache the result for future sequential calls with LRU eviction

      if (resultCache.size >= MAX_CACHE_SIZE) {
        evictOldestCacheEntry();
      }
      resultCache.set(dedupKey, proxy);
      cacheInsertionOrder.push(dedupKey);
      debug(`dedup cached result: ${dedupKey}`);

      return proxy;
    } catch (error) {
      // Error: clear any cached result, log and re-throw
      debug(`dedup error: ${dedupKey}`);
      resultCache.delete(dedupKey);
      // Remove from insertion order if it was added
      const index = cacheInsertionOrder.indexOf(dedupKey);
      if (index !== -1) {
        cacheInsertionOrder.splice(index, 1);
      }
      throw error;
    } finally {
      // Always cleanup in-flight entry
      debug(`dedup cleanup: ${dedupKey}`);
      inFlightDedup.delete(dedupKey);
    }
  })();

  // Store the promise BEFORE any async work happens to prevent race conditions
  inFlightDedup.set(dedupKey, dedupPromise);

  return dedupPromise as any;
}
