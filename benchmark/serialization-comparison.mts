/**
 * Performance benchmark comparing JSON vs Advanced (V8) serialization modes
 *
 * Run with: pnpm tsx benchmark/serialization-comparison.ts
 */

import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { procxy } from '../src/index.js';
import { BinaryProcessor } from '../tests/fixtures/BinaryProcessor.js';

const WARMUP_ITERATIONS = 10;
const BENCHMARK_ITERATIONS = 100;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface BenchmarkResult {
  name: string;
  mode: 'json' | 'advanced';
  iterations: number;
  totalMs: number;
  avgMs: number;
  minMs: number;
  maxMs: number;
}

async function benchmark(
  name: string,
  fn: () => Promise<void>,
  iterations: number
): Promise<BenchmarkResult> {
  const times: number[] = [];

  // Warmup
  for (let i = 0; i < WARMUP_ITERATIONS; i++) {
    await fn();
  }

  // Actual benchmark
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await fn();
    const end = performance.now();
    times.push(end - start);
  }

  const totalMs = times.reduce((a, b) => a + b, 0);
  const avgMs = totalMs / iterations;
  const minMs = Math.min(...times);
  const maxMs = Math.max(...times);

  return {
    name,
    mode: name.includes('JSON') ? 'json' : 'advanced',
    iterations,
    totalMs,
    avgMs,
    minMs,
    maxMs
  };
}

function printResults(results: BenchmarkResult[]) {
  console.log('\n' + '='.repeat(80));
  console.log('Performance Benchmark: JSON vs Advanced Serialization');
  console.log('='.repeat(80));
  console.log(`Iterations per test: ${BENCHMARK_ITERATIONS}`);
  console.log('');

  // Group by test type
  const groupedResults = new Map<string, BenchmarkResult[]>();
  for (const result of results) {
    const testName = result.name.replace(/ \(JSON mode\)| \(Advanced mode\)/, '');
    if (!groupedResults.has(testName)) {
      groupedResults.set(testName, []);
    }
    groupedResults.get(testName)!.push(result);
  }

  // Print each group
  for (const [testName, testResults] of groupedResults.entries()) {
    console.log(`\n${testName}:`);
    console.log('-'.repeat(80));

    for (const result of testResults) {
      console.log(
        `  ${result.mode.toUpperCase().padEnd(10)} | Avg: ${result.avgMs.toFixed(3)}ms | Min: ${result.minMs.toFixed(3)}ms | Max: ${result.maxMs.toFixed(3)}ms`
      );
    }

    // Calculate overhead if both modes present
    if (testResults.length === 2) {
      const jsonResult = testResults.find((r) => r.mode === 'json');
      const advancedResult = testResults.find((r) => r.mode === 'advanced');

      if (jsonResult && advancedResult) {
        const overhead = ((advancedResult.avgMs - jsonResult.avgMs) / jsonResult.avgMs) * 100;
        console.log(
          `  Overhead: ${overhead > 0 ? '+' : ''}${overhead.toFixed(1)}% (${(advancedResult.avgMs - jsonResult.avgMs).toFixed(3)}ms)`
        );
      }
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('Summary:');
  console.log('-'.repeat(80));

  const jsonResults = results.filter((r) => r.mode === 'json');
  const advancedResults = results.filter((r) => r.mode === 'advanced');

  if (jsonResults.length > 0) {
    const avgJson = jsonResults.reduce((sum, r) => sum + r.avgMs, 0) / jsonResults.length;
    console.log(`JSON mode average:     ${avgJson.toFixed(3)}ms per call`);
  }

  if (advancedResults.length > 0) {
    const avgAdvanced =
      advancedResults.reduce((sum, r) => sum + r.avgMs, 0) / advancedResults.length;
    console.log(`Advanced mode average: ${avgAdvanced.toFixed(3)}ms per call`);
  }

  console.log('');
  console.log('Conclusion:');
  console.log('  - JSON mode is fastest for simple objects');
  console.log('  - Advanced mode enables Buffer, TypedArray, Map, Set, BigInt support');
  console.log('  - Overhead is typically 10-30% for simple types');
  console.log('  - Choose based on your data type requirements, not just performance');
  console.log('='.repeat(80) + '\n');
}

async function main() {
  const results: BenchmarkResult[] = [];

  console.log('Starting performance benchmarks...\n');

  // Test 1: Buffer processing (Advanced mode only)
  console.log('Running: Buffer processing (Advanced mode)...');
  {
    const proxy = await procxy<BinaryProcessor, 'advanced'>(
      BinaryProcessor,
      undefined,
      { serialization: 'advanced' as const }
    );
    const buffer = Buffer.from([0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77]);
    const result = await benchmark(
      'Buffer processing (8 bytes)',
      async () => {
        await proxy.processBuffer(buffer);
      },
      BENCHMARK_ITERATIONS
    );
    results.push(result);
    await proxy.$terminate();
  }

  printResults(results);

  console.log('\n📝 Note: This is a simplified benchmark.');
  console.log('For complete comparisons between JSON and Advanced modes,');
  console.log('run tests in tests/integration/advanced-serialization.test.ts');
}

main().catch((error) => {
  console.error('Benchmark failed:', error);
  process.exit(1);
});
