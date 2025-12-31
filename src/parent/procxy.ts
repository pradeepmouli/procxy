import { fork, type ForkOptions } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Constructor, Jsonifiable } from 'type-fest';
import type { Procxy } from '../types/procxy.js';
import type { ProcxyOptions } from '../types/options.js';
import { resolveConstructorModule } from '../shared/module-resolver.js';
import { validateJsonifiableArray, validateV8SerializableArray } from '../shared/serialization.js';
import { createParentProxy } from './parent-proxy.js';
import { IPCClient } from './ipc-client.js';
import { ChildCrashedError, OptionsValidationError, TimeoutError } from '../shared/errors.js';
import type { InitMessage } from '../shared/protocol.js';

const DEFAULT_TIMEOUT_MS = 30000;
const DEFAULT_RETRIES = 3;
const MIN_INIT_TIMEOUT_MS = 1000;

function validateOptions(options: ProcxyOptions): void {
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
    validateJsonifiableArray(options.args as unknown[], 'ProcxyOptions.args');
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

function pickExecArgv(agentPath: string): string[] {
  if (!agentPath.endsWith('.ts')) return [];

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
export async function procxy<T extends Record<string, typeof Object>, C extends keyof T>(
  className: keyof T,
  modulePath?: string,
  options?: ProcxyOptions,
  ...constructorArgs: T[keyof T] extends Constructor<any>
    ? ConstructorParameters<T[keyof T]>
    : never
): Promise<T[C] extends Constructor<infer U> ? Procxy<U> : never>;
export async function procxy<T extends object>(
  Class: Constructor<T>,
  modulePath?: string,
  options?: ProcxyOptions,
  ...constructorArgs: ConstructorParameters<Constructor<T>>
): Promise<Procxy<T>>;
export async function procxy<T extends object | Record<string, typeof Object>, C extends keyof T>(
  classOrClassName: T extends object ? Constructor<T> : C,
  modulePath?: string,
  options?: ProcxyOptions,
  ...constructorArgs: T extends object
    ? ConstructorParameters<Constructor<T>>
    : T[C] extends Constructor<any>
      ? ConstructorParameters<T[C]>
      : never
): Promise<T extends object ? Procxy<T> : T[C] extends Constructor<infer U> ? Procxy<U> : never> {
  validateOptions(options ?? {});

  const serializationMode = options?.serialization ?? 'json';

  // Validate constructor args based on serialization mode
  if (serializationMode === 'json') {
    validateJsonifiableArray(constructorArgs, 'constructor arguments');
  } else {
    validateV8SerializableArray(constructorArgs, 'constructor arguments');
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
  const timeout = options?.timeout ?? DEFAULT_TIMEOUT_MS;
  const retries = options?.retries ?? DEFAULT_RETRIES;

  const agentPath = pickAgentPath();
  const execArgv = pickExecArgv(agentPath);

  const forkOptions: ForkOptions = {
    stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
    cwd: options?.cwd ?? process.cwd(),
    env: { ...process.env, ...options?.env },
    execArgv,
    serialization: serializationMode
  };

  const child = fork(agentPath, toArgStrings(options?.args), forkOptions);

  const ipcClient = new IPCClient(child, timeout, retries);

  const initMessage: InitMessage = {
    type: 'INIT',
    modulePath: resolvedModulePath,
    className: moduleResolution.className,
    constructorArgs: [...constructorArgs]
  };

  child.send(initMessage);
  await waitForInitialization(ipcClient, timeout);

  return createParentProxy<T>(ipcClient) as unknown as Promise<
    T extends object ? Procxy<T> : T[C] extends Constructor<infer U> ? Procxy<U> : never
  >;
}
