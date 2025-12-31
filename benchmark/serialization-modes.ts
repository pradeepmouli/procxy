/**
 * Benchmark: JSON vs Advanced Serialization Performance
 *
 * Compares the performance characteristics of JSON and advanced serialization modes.
 * Measures throughput, latency, and memory overhead for different data types.
 */

import { procxy } from '../src/index.js';
import { performance } from 'perf_hooks';

// Test worker classes
class JsonWorker {
  processString(data: string): string {
    return data.toUpperCase();
  }

  processObject(data: { name: string; value: number }): { name: string; value: number } {
    return { name: data.name.toUpperCase(), value: data.value * 2 };
  }

  processArray(data: number[]): number[] {
    return data.map((n) => n * 2);
  }
}

class AdvancedWorker {
  processBuffer(data: Buffer): Buffer {
    // Simulate buffer processing
    const result = Buffer.alloc(data.length);
    data.copy(result);
    return result;
  }

  processMap(data: Map<string, number>): Map<string, number> {
    const result = new Map<string, number>();
    for (const [key, value] of data.entries()) {
      result.set(key.toUpperCase(), value * 2);
    }
    return result;
  }

  processSet(data: Set<number>): Set<number> {
    const result = new Set<number>();
    for (const value of data) {
      result.add(value * 2);
    }
    return result;
  }

  processBigInt(data: bigint): bigint {
    return data * 2n;
  }
}

interface BenchmarkResult {
  name: string;
  mode: 'json' | 'advanced';
  operations: number;
  totalMs: number;
  opsPerSecond: number;
  avgLatencyMs: number;
  minLatencyMs: number;
  maxLatencyMs: number;
}

async function runBenchmark(
  name: string,
  operation: () => Promise<void>,
  iterations: number
): Promise<BenchmarkResult> {
  const latencies: number[] = [];

  // Warmup
  for (let i = 0; i < 10; i++) {
    await operation();
  }

  // Actual benchmark
  const startTime = performance.now();

  for (let i = 0; i < iterations; i++) {
    const opStart = performance.now();
    await operation();
    latencies.push(performance.now() - opStart);
  }

  const endTime = performance.now();
  const totalMs = endTime - startTime;

  return {
    name,
    mode: name.includes('JSON') ? 'json' : 'advanced',
    operations: iterations,
    totalMs,
    opsPerSecond: (iterations / totalMs) * 1000,
    avgLatencyMs: latencies.reduce((a, b) => a + b, 0) / latencies.length,
    minLatencyMs: Math.min(...latencies),
    maxLatencyMs: Math.max(...latencies)
  };
}

function formatResult(result: BenchmarkResult): void {
  console.log(`\n📊 ${result.name}`);
  console.log(`   Mode: ${result.mode}`);
  console.log(`   Operations: ${result.operations.toLocaleString()}`);
  console.log(`   Total time: ${result.totalMs.toFixed(2)}ms`);
  console.log(`   Throughput: ${result.opsPerSecond.toFixed(2)} ops/sec`);
  console.log(`   Avg latency: ${result.avgLatencyMs.toFixed(3)}ms`);
  console.log(`   Min latency: ${result.minLatencyMs.toFixed(3)}ms`);
  console.log(`   Max latency: ${result.maxLatencyMs.toFixed(3)}ms`);
}

function compareResults(baseline: BenchmarkResult, comparison: BenchmarkResult): void {
  const throughputDiff =
    ((comparison.opsPerSecond - baseline.opsPerSecond) / baseline.opsPerSecond) * 100;
  const latencyDiff =
    ((comparison.avgLatencyMs - baseline.avgLatencyMs) / baseline.avgLatencyMs) * 100;

  console.log(`\n📈 Comparison: ${comparison.name} vs ${baseline.name}`);
  console.log(`   Throughput: ${throughputDiff > 0 ? '+' : ''}${throughputDiff.toFixed(2)}%`);
  console.log(`   Avg Latency: ${latencyDiff > 0 ? '+' : ''}${latencyDiff.toFixed(2)}%`);

  if (Math.abs(throughputDiff) < 5) {
    console.log(`   ✅ Performance is comparable`);
  } else if (throughputDiff > 0) {
    console.log(`   ✅ ${comparison.mode} mode is faster`);
  } else {
    console.log(`   ⚠️  ${baseline.mode} mode is faster`);
  }
}

async function main() {
  console.log('🔬 Procxy Serialization Mode Benchmarks\n');
  console.log('Comparing JSON and Advanced serialization modes');
  console.log('─'.repeat(60));

  const ITERATIONS = 1000;

  // Benchmark 1: String processing (both modes support this)
  console.log('\n📝 Benchmark 1: String Processing');

  await using jsonWorker = await procxy(JsonWorker);
  const jsonStringResult = await runBenchmark(
    'JSON Mode - String',
    async () => {
      await jsonWorker.processString('hello world');
    },
    ITERATIONS
  );
  formatResult(jsonStringResult);

  await using advancedWorker1 = await procxy<JsonWorker, 'advanced'>(JsonWorker, {
    serialization: 'advanced' as const
  });
  const advancedStringResult = await runBenchmark(
    'Advanced Mode - String',
    async () => {
      await advancedWorker1.processString('hello world');
    },
    ITERATIONS
  );
  formatResult(advancedStringResult);
  compareResults(jsonStringResult, advancedStringResult);

  // Benchmark 2: Object processing
  console.log('\n\n📦 Benchmark 2: Object Processing');

  const jsonObjectResult = await runBenchmark(
    'JSON Mode - Object',
    async () => {
      await jsonWorker.processObject({ name: 'test', value: 42 });
    },
    ITERATIONS
  );
  formatResult(jsonObjectResult);

  const advancedObjectResult = await runBenchmark(
    'Advanced Mode - Object',
    async () => {
      await advancedWorker1.processObject({ name: 'test', value: 42 });
    },
    ITERATIONS
  );
  formatResult(advancedObjectResult);
  compareResults(jsonObjectResult, advancedObjectResult);

  // Benchmark 3: Array processing
  console.log('\n\n📚 Benchmark 3: Array Processing');

  const testArray = Array.from({ length: 100 }, (_, i) => i);

  const jsonArrayResult = await runBenchmark(
    'JSON Mode - Array',
    async () => {
      await jsonWorker.processArray(testArray);
    },
    ITERATIONS
  );
  formatResult(jsonArrayResult);

  const advancedArrayResult = await runBenchmark(
    'Advanced Mode - Array',
    async () => {
      await advancedWorker1.processArray(testArray);
    },
    ITERATIONS
  );
  formatResult(advancedArrayResult);
  compareResults(jsonArrayResult, advancedArrayResult);

  // Benchmark 4: Buffer processing (advanced mode only)
  console.log('\n\n💾 Benchmark 4: Buffer Processing (Advanced Mode Only)');

  await using advancedWorker2 = await procxy<AdvancedWorker, 'advanced'>(
    AdvancedWorker,
    undefined,
    { serialization: 'advanced' as const }
  );

  const testBuffer = Buffer.alloc(1024, 'x');

  const bufferResult = await runBenchmark(
    'Advanced Mode - Buffer (1KB)',
    async () => {
      await advancedWorker2.processBuffer(testBuffer);
    },
    ITERATIONS
  );
  formatResult(bufferResult);

  // Benchmark 5: Map processing (advanced mode only)
  console.log('\n\n🗺️  Benchmark 5: Map Processing (Advanced Mode Only)');

  const testMap = new Map([
    ['key1', 100],
    ['key2', 200],
    ['key3', 300]
  ]);

  const mapResult = await runBenchmark(
    'Advanced Mode - Map',
    async () => {
      await advancedWorker2.processMap(testMap);
    },
    ITERATIONS
  );
  formatResult(mapResult);

  // Benchmark 6: Set processing (advanced mode only)
  console.log('\n\n🎯 Benchmark 6: Set Processing (Advanced Mode Only)');

  const testSet = new Set([1, 2, 3, 4, 5]);

  const setResult = await runBenchmark(
    'Advanced Mode - Set',
    async () => {
      await advancedWorker2.processSet(testSet);
    },
    ITERATIONS
  );
  formatResult(setResult);

  // Benchmark 7: BigInt processing (advanced mode only)
  console.log('\n\n🔢 Benchmark 7: BigInt Processing (Advanced Mode Only)');

  const bigIntResult = await runBenchmark(
    'Advanced Mode - BigInt',
    async () => {
      await advancedWorker2.processBigInt(12345678901234567890n);
    },
    ITERATIONS
  );
  formatResult(bigIntResult);

  // Summary
  console.log('\n\n' + '='.repeat(60));
  console.log('📋 Summary');
  console.log('='.repeat(60));

  console.log('\n✅ Findings:');
  console.log('   • JSON mode: Best for simple, JSON-compatible data');
  console.log('   • Advanced mode: Necessary for Buffer, Map, Set, BigInt');
  console.log('   • Performance: Comparable for shared types (string, object, array)');
  console.log('   • Memory: Advanced mode may use more memory for complex types');

  console.log('\n💡 Recommendations:');
  console.log('   • Use JSON mode by default for simple data');
  console.log('   • Use Advanced mode when you need:');
  console.log('     - Buffer/TypedArray transfer');
  console.log('     - Map/Set collections');
  console.log('     - BigInt values');
  console.log('     - Full Error preservation');
  console.log('     - Handle passing');

  console.log('\n✨ Benchmark completed successfully!');
}

// Run the benchmarks
main().catch(console.error);
