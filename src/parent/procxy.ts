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

const DEFAULT_TIMEOUT_MS = 30000;
const DEFAULT_RETRIES = 3;
const MIN_INIT_TIMEOUT_MS = 1000;
const MAX_CACHE_SIZE = 100;

/**
 * Deduplication cache: tracks in-flight procxy creations to avoid duplicate child spawning.
 * Key format: "ClassName:modulePath:optionsHash:argsHash"
 * Value: Promise that resolves to the initialized Procxy proxy
 */
const inFlightDedup = new Map<string, Promise<unknown>>();

/**
 * Result cache: stores successfully created procxy instances for reuse on sequential calls.
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

let cachedDebugLogger: ((msg: string) => void) | null = null;

function getDebugLogger() {
  if (cachedDebugLogger) {
    return cachedDebugLogger;
  }

  // Reuse debug logging from module-resolver pattern
  try {
    const createDebug = require('debug');
    cachedDebugLogger = createDebug('procxy:dedup');
  } catch {
    if (process.env['PROCXY_DEBUG_DEDUP'] === '1') {
      cachedDebugLogger = (msg: string) => console.warn(`[procxy:dedup] ${msg}`);
    } else {
      cachedDebugLogger = () => {}; // no-op
    }
  }

  return cachedDebugLogger;
}

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
 * Create a proxy for a remote object instance running in a child process.
 *
 * This function spawns a child process via `fork()`, instantiates the specified class
 * in that child, and returns a proxy object that transparently forwards method calls
 * over IPC. All methods become async and return Promises.
 *
 * @template T - The type of the class to instantiate remotely
 * @param classOrClassName - The class constructor or class name to instantiate in the child process
 * @param modulePath - Path to the module containing the class (required)
 * @param options - Optional {@link ProcxyOptions} for process configuration
 * @param constructorArgs - Constructor arguments (must be JSON-serializable)
 * @returns A Promise that resolves to a {@link Procxy}<T> proxy object
 *
 * @throws {OptionsValidationError} If ProcxyOptions contain invalid values
 * @throws {ModuleResolutionError} If the module path cannot be resolved
 * @throws {ChildCrashedError} If the child process exits during initialization
 * @throws {TimeoutError} If initialization exceeds the configured timeout
 * @throws {TypeError} If constructor arguments are not JSON-serializable (FR-019, FR-022)
 *
 * @example
 * ```typescript
 * import { procxy } from 'procxy';
 *
 * // Basic usage - no constructor args
 * class Calculator {
 *   add(a: number, b: number): number {
 *     return a + b;
 *   }
 * }
 *
 * const calc = await procxy(Calculator, './calculator.js');
 * const result = await calc.add(5, 7); // 12
 * await calc.$terminate(); // Clean up
 * ```
 *
 * @example
 * ```typescript
 * // With constructor arguments
 * class Worker {
 *   constructor(public name: string, public threads: number) {}
 *
 *   async process(data: string[]): Promise<string[]> {
 *     // Heavy processing in child process
 *     return data.map(s => s.toUpperCase());
 *   }
 * }
 *
 * const worker = await procxy(Worker, './worker.js', undefined, 'MyWorker', 4);
 * const result = await worker.process(['hello', 'world']);
 * await worker.$terminate();
 * ```
 *
 * @example
 * ```typescript
 * // With options (timeout, retries, custom env)
 * const worker = await procxy(
 *   Worker,
 *   './worker.js',       // Module path is required
 *   {
 *     timeout: 60000,      // 60s timeout per method call
 *     retries: 5,          // Retry failed calls 5 times
 *     cwd: '/tmp',         // Child process working directory
 *     env: {               // Custom environment variables
 *       NODE_ENV: 'production',
 *       API_KEY: process.env.API_KEY
 *     }
 *   },
 *   'MyWorker',            // Constructor arguments follow options
 *   4
 * );
 * ```
 *
 * @example
 * ```typescript
 * // Lifecycle management
 * const worker = await procxy(Worker, './worker.js');
 *
 * // Access underlying child process
 * console.log('Child PID:', worker.$process.pid);
 *
 * // Terminate when done
 * await worker.$terminate(); // Kills child and rejects pending calls
 * ```
 *
 * @see {@link Procxy} for the proxy type definition
 * @see {@link ProcxyOptions} for available configuration options
 * @see {@link https://github.com/pradeepmouli/procxy#readme | Procxy Documentation}
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
      } catch (error) {
        // Validation failed - try sanitizing and re-validating
        actualConstructorArgs = sanitizeForV8Array(actualConstructorArgs);
        validateV8SerializableArray(actualConstructorArgs, 'constructor arguments');
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

    // If the cached proxy exposes lifecycle information, ensure it is still alive
    const hasIsTerminated =
      cached && typeof (cached as any).$isTerminated === 'function';
    const hasTerminatedFlag = cached && '$terminated' in (cached as any);

    let isTerminated = false;
    if (hasIsTerminated) {
      try {
        isTerminated = !!(cached as any).$isTerminated();
      } catch {
        // If the health check itself fails, treat as terminated to avoid reusing it
        isTerminated = true;
      }
    } else if (hasTerminatedFlag) {
      isTerminated = !!(cached as any).$terminated;
    }

    if (isTerminated) {
      debug(`dedup cached (stale, evicting): ${dedupKey}`);
      resultCache.delete(dedupKey);
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
