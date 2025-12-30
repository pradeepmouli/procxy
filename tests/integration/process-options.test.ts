import { describe, it, expect, afterEach } from 'vitest';
import { resolve } from 'path';
import { tmpdir } from 'os';
import { mkdtempSync, rmSync, writeFileSync, realpathSync } from 'fs';
import { join } from 'path';
import { procxy } from '../../src/index.js';
import { ProcessOptionsWorker } from '../fixtures/process-options-worker.js';

// Use absolute paths for module resolution
const CALCULATOR_PATH = resolve(process.cwd(), 'tests/fixtures/calculator.ts');
const PROCESS_OPTIONS_WORKER_PATH = resolve(
  process.cwd(),
  'tests/fixtures/process-options-worker.ts'
);

describe('Custom Child Process Options', () => {
  const activeProxies: Array<{ $terminate: () => Promise<void> }> = [];
  let tempDirs: string[] = [];

  afterEach(async () => {
    // Clean up any proxies that weren't terminated in the test
    await Promise.all(activeProxies.map((p) => p.$terminate().catch(() => {})));
    activeProxies.length = 0;

    // Clean up temp directories
    tempDirs.forEach((dir) => {
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    });
    tempDirs = [];
  });

  describe('custom environment variables', () => {
    it('should pass custom environment variables to child process', async () => {
      const worker = await procxy(ProcessOptionsWorker, PROCESS_OPTIONS_WORKER_PATH, {
        env: {
          CUSTOM_VAR: 'test_value_123',
          ANOTHER_VAR: 'hello_world'
        }
      });
      activeProxies.push(worker);

      const customVar = await worker.getEnv('CUSTOM_VAR');
      const anotherVar = await worker.getEnv('ANOTHER_VAR');

      expect(customVar).toBe('test_value_123');
      expect(anotherVar).toBe('hello_world');

      await worker.$terminate();
    });

    it('should inherit parent env vars by default', async () => {
      // Set a parent env var
      process.env.PARENT_VAR = 'inherited';

      const worker = await procxy(ProcessOptionsWorker, PROCESS_OPTIONS_WORKER_PATH);
      activeProxies.push(worker);

      const inherited = await worker.getEnv('PARENT_VAR');
      expect(inherited).toBe('inherited');

      await worker.$terminate();
      delete process.env.PARENT_VAR;
    });

    it('should merge custom env with parent env', async () => {
      process.env.PARENT_VAR = 'parent_value';

      const worker = await procxy(ProcessOptionsWorker, PROCESS_OPTIONS_WORKER_PATH, {
        env: {
          CHILD_VAR: 'child_value'
        }
      });
      activeProxies.push(worker);

      const parentVar = await worker.getEnv('PARENT_VAR');
      const childVar = await worker.getEnv('CHILD_VAR');

      expect(parentVar).toBe('parent_value');
      expect(childVar).toBe('child_value');

      await worker.$terminate();
      delete process.env.PARENT_VAR;
    });
  });

  describe('custom working directory', () => {
    it('should set child process working directory', async () => {
      // Create a temporary directory
      const tempDir = mkdtempSync(join(tmpdir(), 'procxy-test-'));
      tempDirs.push(tempDir);

      const worker = await procxy(ProcessOptionsWorker, PROCESS_OPTIONS_WORKER_PATH, {
        cwd: tempDir
      });
      activeProxies.push(worker);

      const cwd = await worker.getCwd();
      expect(realpathSync(cwd)).toBe(realpathSync(tempDir));

      await worker.$terminate();
    });

    it('should allow child to access files relative to cwd', async () => {
      // Create a temporary directory with a test file
      const tempDir = mkdtempSync(join(tmpdir(), 'procxy-test-'));
      tempDirs.push(tempDir);

      const testContent = 'Hello from test file!';
      writeFileSync(join(tempDir, 'test.txt'), testContent);

      const worker = await procxy(ProcessOptionsWorker, PROCESS_OPTIONS_WORKER_PATH, {
        cwd: tempDir
      });
      activeProxies.push(worker);

      // Read file relative to cwd
      const content = await worker.readFile('test.txt');
      expect(content).toBe(testContent);

      await worker.$terminate();
    });

    it('should use parent cwd by default', async () => {
      const parentCwd = process.cwd();

      const worker = await procxy(ProcessOptionsWorker, PROCESS_OPTIONS_WORKER_PATH);
      activeProxies.push(worker);

      const cwd = await worker.getCwd();
      expect(cwd).toBe(parentCwd);

      await worker.$terminate();
    });
  });

  describe('custom command line arguments', () => {
    it('should pass custom arguments to child process', async () => {
      const worker = await procxy(ProcessOptionsWorker, PROCESS_OPTIONS_WORKER_PATH, {
        args: ['--custom-arg', 'value123', '--flag']
      });
      activeProxies.push(worker);

      const argv = await worker.getArgv();

      // Check that custom args are present
      expect(argv).toContain('--custom-arg');
      expect(argv).toContain('value123');
      expect(argv).toContain('--flag');

      await worker.$terminate();
    });

    it('should handle JSON-serializable argument types', async () => {
      const worker = await procxy(ProcessOptionsWorker, PROCESS_OPTIONS_WORKER_PATH, {
        args: ['string', 42, true, { key: 'value' }, [1, 2, 3]]
      });
      activeProxies.push(worker);

      const argv = await worker.getArgv();

      // Check that args are serialized correctly
      expect(argv).toContain('string');
      expect(argv).toContain('42');
      expect(argv).toContain('true');
      expect(argv.some((arg) => arg.includes('"key"'))).toBe(true); // JSON object
      expect(argv.some((arg) => arg.includes('[1,2,3]'))).toBe(true); // JSON array

      await worker.$terminate();
    });
  });

  describe('option validation', () => {
    it('should reject invalid cwd (non-existent directory)', async () => {
      const Calculator = (await import('../fixtures/calculator.js')).Calculator;

      await expect(
        procxy(Calculator, CALCULATOR_PATH, {
          cwd: '/non/existent/directory'
        })
      ).rejects.toThrow(/must be an existing directory/i);
    });

    it('should reject invalid env values (non-string)', async () => {
      const Calculator = (await import('../fixtures/calculator.js')).Calculator;

      await expect(
        procxy(Calculator, CALCULATOR_PATH, {
          env: {
            INVALID: 123 as any // Non-string value
          }
        })
      ).rejects.toThrow(/environment variables must be strings/i);
    });

    it('should reject invalid timeout (negative)', async () => {
      const Calculator = (await import('../fixtures/calculator.js')).Calculator;

      await expect(
        procxy(Calculator, CALCULATOR_PATH, {
          timeout: -100
        })
      ).rejects.toThrow(/must be a positive number/i);
    });

    it('should reject invalid retries (negative)', async () => {
      const Calculator = (await import('../fixtures/calculator.js')).Calculator;

      await expect(
        procxy(Calculator, CALCULATOR_PATH, {
          retries: -5
        })
      ).rejects.toThrow(/must be a non-negative number/i);
    });
  });
});
