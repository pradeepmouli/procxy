/**
 * Performance benchmark comparing procxy vs tinypool
 *
 * Both libraries support child_process runtime, making this a fair comparison.
 * We measure:
 * 1. Cold start time (spawning the worker/process)
 * 2. Method call overhead (round-trip IPC latency)
 * 3. Throughput (calls per second)
 *
 * Run with: pnpm tsx benchmark/compare.ts
 */

import Tinypool from 'tinypool';
import { procxy } from '../src/index.js';
import { Calculator } from '../tests/fixtures/calculator.js';
import { ca } from 'zod/locales';

const WARMUP_CALLS = 10;
const BENCHMARK_CALLS = 100;

interface BenchmarkResult {
  library: string;
  coldStartMs: number;
  avgCallMs: number;
  callsPerSecond: number;
  totalTimeMs: number;
}

async function benchmarkProcxy(): Promise<BenchmarkResult> {
  // Measure cold start
  const coldStartStart = performance.now();
  const calculator = await procxy(Calculator);
  const coldStartMs = performance.now() - coldStartStart;

  // Warmup
  for (let i = 0; i < WARMUP_CALLS; i++) {
    await calculator.add(1, 2);
  }

  // Benchmark method calls
  const callTimes: number[] = [];
  const benchStart = performance.now();

  for (let i = 0; i < BENCHMARK_CALLS; i++) {
    const start = performance.now();
    await calculator.add(i, i + 1);
    callTimes.push(performance.now() - start);
  }

  const totalTimeMs = performance.now() - benchStart;
  const avgCallMs = callTimes.reduce((a, b) => a + b, 0) / callTimes.length;

  // Cleanup
  await calculator.$terminate();

  return {
    library: 'procxy (child_process)',
    coldStartMs,
    avgCallMs,
    callsPerSecond: Math.round(BENCHMARK_CALLS / (totalTimeMs / 1000)),
    totalTimeMs
  };
}

async function benchmarkTinypool(): Promise<BenchmarkResult> {
  // Measure cold start
  const coldStartStart = performance.now();
  const pool = new Tinypool({
    filename: new URL('./tinypool-worker.ts', import.meta.url).href,
    runtime: 'child_process',
    minThreads: 1,
    maxThreads: 1
  });
  // Force worker spawn by running a task
  await pool.run({ a: 0, b: 0 });
  const coldStartMs = performance.now() - coldStartStart;

  // Warmup
  for (let i = 0; i < WARMUP_CALLS; i++) {
    await pool.run({ a: 1, b: 2 });
  }

  // Benchmark method calls
  const callTimes: number[] = [];
  const benchStart = performance.now();

  for (let i = 0; i < BENCHMARK_CALLS; i++) {
    const start = performance.now();
    await pool.run({ a: i, b: i + 1 });
    callTimes.push(performance.now() - start);
  }

  const totalTimeMs = performance.now() - benchStart;
  const avgCallMs = callTimes.reduce((a, b) => a + b, 0) / callTimes.length;

  // Cleanup
  await pool.destroy();

  return {
    library: 'tinypool (child_process)',
    coldStartMs,
    avgCallMs,
    callsPerSecond: Math.round(BENCHMARK_CALLS / (totalTimeMs / 1000)),
    totalTimeMs
  };
}

async function benchmarkTinypoolWorkerThreads(): Promise<BenchmarkResult> {
  // Measure cold start
  const coldStartStart = performance.now();
  const pool = new Tinypool({
    filename: new URL('./tinypool-worker.ts', import.meta.url).href,
    runtime: 'worker_threads',
    minThreads: 1,
    maxThreads: 1
  });
  // Force worker spawn by running a task
  await pool.run({ a: 0, b: 0 });
  const coldStartMs = performance.now() - coldStartStart;

  // Warmup
  for (let i = 0; i < WARMUP_CALLS; i++) {
    await pool.run({ a: 1, b: 2 });
  }

  // Benchmark method calls
  const callTimes: number[] = [];
  const benchStart = performance.now();

  for (let i = 0; i < BENCHMARK_CALLS; i++) {
    const start = performance.now();
    await pool.run({ a: i, b: i + 1 });
    callTimes.push(performance.now() - start);
  }

  const totalTimeMs = performance.now() - benchStart;
  const avgCallMs = callTimes.reduce((a, b) => a + b, 0) / callTimes.length;

  // Cleanup
  await pool.destroy();

  return {
    library: 'tinypool (worker_threads)',
    coldStartMs,
    avgCallMs,
    callsPerSecond: Math.round(BENCHMARK_CALLS / (totalTimeMs / 1000)),
    totalTimeMs
  };
}

function printResults(results: BenchmarkResult[]): void {
  console.log('\n' + '='.repeat(80));
  console.log('BENCHMARK RESULTS: procxy vs tinypool');
  console.log('='.repeat(80));
  console.log(
    `\nConfiguration: ${WARMUP_CALLS} warmup calls, ${BENCHMARK_CALLS} benchmark calls\n`
  );

  // Table header
  console.log('| Library                      | Cold Start | Avg Call | Calls/sec | Total Time |');
  console.log('|------------------------------|------------|----------|-----------|------------|');

  for (const r of results) {
    console.log(
      `| ${r.library.padEnd(28)} | ${r.coldStartMs.toFixed(2).padStart(8)}ms | ${r.avgCallMs.toFixed(3).padStart(6)}ms | ${r.callsPerSecond.toString().padStart(9)} | ${r.totalTimeMs.toFixed(2).padStart(8)}ms |`
    );
  }

  console.log('\n' + '='.repeat(80));

  // Analysis
  const procxyResult = results.find((r) => r.library.includes('procxy'))!;
  const tinypoolCPResult = results.find(
    (r) => r.library.includes('tinypool') && r.library.includes('child_process')
  )!;
  const tinypoolWTResult = results.find(
    (r) => r.library.includes('tinypool') && r.library.includes('worker_threads')
  )!;

  console.log('\nANALYSIS:');
  console.log('-'.repeat(40));

  // Compare with tinypool child_process (fair comparison)
  const cpCallRatio = procxyResult.avgCallMs / tinypoolCPResult.avgCallMs;
  console.log(`\nprocxy vs tinypool (child_process) - same isolation model:`);
  console.log(
    `  Call overhead: procxy is ${cpCallRatio < 1 ? (1 / cpCallRatio).toFixed(2) + 'x faster' : cpCallRatio.toFixed(2) + 'x slower'}`
  );

  // Compare with worker_threads (different isolation model)
  const wtCallRatio = procxyResult.avgCallMs / tinypoolWTResult.avgCallMs;
  console.log(`\nprocxy (child_process) vs tinypool (worker_threads):`);
  console.log(
    `  Call overhead: procxy is ${wtCallRatio < 1 ? (1 / wtCallRatio).toFixed(2) + 'x faster' : wtCallRatio.toFixed(2) + 'x slower'}`
  );
  console.log(`  Note: worker_threads has lower IPC overhead but shares V8 heap with main thread`);

  console.log('\n' + '='.repeat(80) + '\n');
}

async function main(): Promise<void> {
  console.log('Starting benchmark...\n');

  const results: BenchmarkResult[] = [];

  console.log('Benchmarking procxy (child_process)...');
  results.push(await benchmarkProcxy());

  console.log('Benchmarking tinypool (child_process)...');
  results.push(await benchmarkTinypool());

  console.log('Benchmarking tinypool (worker_threads)...');
  results.push(await benchmarkTinypoolWorkerThreads());

  printResults(results);
}

main().catch(console.error);
