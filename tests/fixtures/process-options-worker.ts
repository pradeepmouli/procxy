import { readFileSync } from 'fs';

/**
 * Test fixture: Worker that can read process options (env, cwd, args).
 * Used for US5 (Custom Process Options) tests.
 */
export class ProcessOptionsWorker {
  /**
   * Get an environment variable value.
   */
  getEnv(key: string): string | undefined {
    return process.env[key];
  }

  /**
   * Get the current working directory.
   */
  getCwd(): string {
    return process.cwd();
  }

  /**
   * Get the process arguments.
   */
  getArgv(): string[] {
    return process.argv;
  }

  /**
   * Read a file from the filesystem.
   * Path is relative to the process working directory.
   */
  readFile(filename: string): string {
    return readFileSync(filename, 'utf-8');
  }
}
