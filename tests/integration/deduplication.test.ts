import { describe, it, expect, beforeEach } from 'vitest';
import { procxy } from '../../src/index.js';
import { DedupCounter } from '../fixtures/dedup-counter.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// @ts-ignore - import.meta is supported in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dedupCounterPath = join(__dirname, '../fixtures/dedup-counter.ts');

/**
 * Integration test for procxy deduplication.
 * Verifies that concurrent procxy() calls for the same target avoid duplicate child spawning.
 */
describe('Procxy Deduplication Integration', () => {
  beforeEach(async () => {
    // Note: We can't easily reset the counter across child processes
    // so each test uses different constructor args or options to get fresh instances
  });

  it('should deduplicate concurrent procxy calls with identical params', async () => {
    // Create multiple concurrent procxy calls with identical parameters
    // They should all return the same proxy instance (same child process)
    const promises = [
      procxy(DedupCounter, dedupCounterPath, undefined, 100),
      procxy(DedupCounter, dedupCounterPath, undefined, 100),
      procxy(DedupCounter, dedupCounterPath, undefined, 100)
    ];

    const [proxy1, proxy2, proxy3] = await Promise.all(promises);

    try {
      // All three should be the same proxy instance with the same instance ID
      const id1 = await proxy1.getInstanceId();
      const id2 = await proxy2.getInstanceId();
      const id3 = await proxy3.getInstanceId();

      expect(id1).toBe(id2);
      expect(id2).toBe(id3);

      // Verify they share state (same child process)
      await proxy1.increment(5);
      const value2 = await proxy2.getValue();
      expect(value2).toBe(105); // 100 + 5
    } finally {
      await proxy1.$terminate();
      // proxy2 and proxy3 should already be terminated since they're the same instance
    }
  });

  it('should NOT deduplicate calls with different constructor args', async () => {
    // Create procxy calls with different constructor arguments
    // They should create separate child processes
    //  Use unique values to avoid cache collision with other tests
    const proxy1 = await procxy(DedupCounter, dedupCounterPath, undefined, 1001);
    const proxy2 = await procxy(DedupCounter, dedupCounterPath, undefined, 1002);

    try {
      const pid1 = await proxy1.getProcessId();
      const pid2 = await proxy2.getProcessId();

      // Different constructor args = different child processes
      expect(pid1).not.toBe(pid2);

      const value1 = await proxy1.getValue();
      const value2 = await proxy2.getValue();

      expect(value1).toBe(1001);
      expect(value2).toBe(1002);
    } finally {
      await proxy1.$terminate();
      await proxy2.$terminate();
    }
  });

  it('should NOT deduplicate calls with different options (env)', async () => {
    // Create procxy calls with different environment variables
    // They should create separate child processes
    // Use unique values to avoid cache collision
    const proxy1 = await procxy(
      DedupCounter,
      dedupCounterPath,
      { env: { TEST_DEDUP_VAR: 'env_test_1' } },
      2001
    );
    const proxy2 = await procxy(
      DedupCounter,
      dedupCounterPath,
      { env: { TEST_DEDUP_VAR: 'env_test_2' } },
      2001
    );

    try {
      const pid1 = await proxy1.getProcessId();
      const pid2 = await proxy2.getProcessId();

      // Different env = different child processes (isolation requirement)
      expect(pid1).not.toBe(pid2);
    } finally {
      await proxy1.$terminate();
      await proxy2.$terminate();
    }
  });

  it('should NOT deduplicate calls with different options (cwd)', async () => {
    // Create procxy calls with different working directories
    // Use unique values to avoid cache collision
    const proxy1 = await procxy(DedupCounter, dedupCounterPath, { cwd: process.cwd() }, 3001);
    const proxy2 = await procxy(
      DedupCounter,
      dedupCounterPath,
      { cwd: join(process.cwd(), 'tests') },
      3001
    );

    try {
      const pid1 = await proxy1.getProcessId();
      const pid2 = await proxy2.getProcessId();

      // Different cwd = different child processes (isolation requirement)
      expect(pid1).not.toBe(pid2);
    } finally {
      await proxy1.$terminate();
      await proxy2.$terminate();
    }
  });

  it('should reuse cached result for sequential calls with same params', async () => {
    // First call creates the proxy
    const proxy1 = await procxy(DedupCounter, dedupCounterPath, undefined, 300);
    const id1 = await proxy1.getInstanceId();

    // Second call (after first completes) should return cached result
    const proxy2 = await procxy(DedupCounter, dedupCounterPath, undefined, 300);
    const id2 = await proxy2.getInstanceId();

    try {
      // Should be same instance (from result cache)
      expect(id1).toBe(id2);

      // Verify they share state
      await proxy1.increment(10);
      const value2 = await proxy2.getValue();
      expect(value2).toBe(310); // 300 + 10
    } finally {
      await proxy1.$terminate();
    }
  });

  it('should handle mix of concurrent and sequential calls', async () => {
    // Start with concurrent calls
    const concurrent = await Promise.all([
      procxy(DedupCounter, dedupCounterPath, undefined, 400),
      procxy(DedupCounter, dedupCounterPath, undefined, 400),
      procxy(DedupCounter, dedupCounterPath, undefined, 400)
    ]);

    const [proxy1, proxy2, proxy3] = concurrent;

    try {
      // All concurrent calls should get same instance
      const id1 = await proxy1.getInstanceId();
      const id2 = await proxy2.getInstanceId();
      const id3 = await proxy3.getInstanceId();

      expect(id1).toBe(id2);
      expect(id2).toBe(id3);

      // Now make a sequential call with same params
      const proxy4 = await procxy(DedupCounter, dedupCounterPath, undefined, 400);
      const id4 = await proxy4.getInstanceId();

      // Sequential call should also get same cached instance
      expect(id4).toBe(id1);

      // Verify shared state
      await proxy1.increment(1);
      const value4 = await proxy4.getValue();
      expect(value4).toBe(401);
    } finally {
      await proxy1.$terminate();
    }
  });

  it('should handle deduplication with advanced serialization mode', async () => {
    // Test that serialization mode is included in cache key
    const proxy1 = await procxy(
      DedupCounter,
      dedupCounterPath,
      { serialization: 'advanced' } as const,
      500
    );
    const proxy2 = await procxy(
      DedupCounter,
      dedupCounterPath,
      { serialization: 'advanced' } as const,
      500
    );

    try {
      const id1 = await proxy1.getInstanceId();
      const id2 = await proxy2.getInstanceId();

      // Same serialization mode and args = same instance
      expect(id1).toBe(id2);
    } finally {
      await proxy1.$terminate();
    }
  });

  it('should NOT deduplicate different serialization modes', async () => {
    // Different serialization modes should create separate instances
    // Use unique values to avoid cache collision
    const proxy1 = await procxy(DedupCounter, dedupCounterPath, undefined, 4001);
    const proxy2 = await procxy(
      DedupCounter,
      dedupCounterPath,
      { serialization: 'advanced' } as const,
      4001
    );

    try {
      const pid1 = await proxy1.getProcessId();
      const pid2 = await proxy2.getProcessId();

      // Different serialization mode = different child processes
      expect(pid1).not.toBe(pid2);
    } finally {
      await proxy1.$terminate();
      await proxy2.$terminate();
    }
  });
});
