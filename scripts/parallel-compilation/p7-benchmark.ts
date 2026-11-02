/**
 * @author Aidan Boissonneault
 * @file p7-benchmark.ts
 * @purpose Provides p7 benchmark behavior for the scripts parallel compilation in repository tooling.
 * @last-edited October 6, 2026
 */

import { readFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { writeJsonReport } from './report-output.js';
import { P7ServiceClient } from './p7-service-client.js';
import { responseContract } from './p7-response-contract.js';
import {
  summarizeSamples,
  type BenchmarkSample,
} from './p7-benchmark-summary.js';
import { runPerformance, type Workload } from './p7-performance-runner.js';

/**
 * Correctness comparison of classic and parallel output for one workload, including both output
 * hashes.
 */
type EquivalenceResult = {
  workers: number;
  workload: string;
  classicHash: string;
  parallelHash: string;
  match: boolean;
};

/** Runs the complete P7 equivalence and repeated performance protocol. */
async function run(): Promise<void> {
  const rootPath = resolve(readArg('--root', '.'));
  const cliPath = resolve(readArg('--cli', 'packages/cli/dist/index.js'));
  const outPath = resolve(
    readArg(
      '--out',
      '.bushscad-analysis/parallel-compilation/p7-benchmark.json',
    ),
  );
  const runs = positiveInteger(readArg('--runs', '3'));
  const workers = readArg('--workers', '1,2,4').split(',').map(positiveInteger);
  const scope = readArg('--scope', 'full');
  const correctnessCases = await loadSuiteCases(rootPath);
  const performanceCases = performanceWorkloads(rootPath);
  const equivalence: EquivalenceResult[] = [];
  const samples: BenchmarkSample[] = [];
  const lifecycle: unknown[] = [];

  for (const workerCount of workers)
    await runWorkerMatrix({
      cliPath,
      rootPath,
      workerCount,
      scope,
      runs,
      correctnessCases,
      performanceCases,
      equivalence,
      samples,
      lifecycle,
    });

  const mismatches = equivalence.filter((result) => !result.match);
  const report = {
    generatedAt: new Date().toISOString(),
    node: process.version,
    rootPath,
    cliPath,
    configuration: { runs, workers, scope },
    lifecycle,
    equivalence: {
      comparisons: equivalence.length,
      matches: equivalence.length - mismatches.length,
      mismatches,
      results: equivalence,
    },
    summaries: summarizeSamples(samples),
    samples,
  };
  await writeJsonReport(outPath, report, {
    outPath,
    lifecycle,
    equivalence: report.equivalence,
    summaries: report.summaries,
  });
  if (mismatches.length > 0) process.exitCode = 2;
}

/**
 * Configuration for a worker-count benchmark, including CLI and workspace paths, selected
 * suites, and measured results.
 */
type WorkerMatrixInput = {
  cliPath: string;
  rootPath: string;
  workerCount: number;
  scope: string;
  runs: number;
  correctnessCases: readonly Workload[];
  performanceCases: readonly Workload[];
  equivalence: EquivalenceResult[];
  samples: BenchmarkSample[];
  lifecycle: unknown[];
};

/** Runs one isolated worker-count matrix and always disposes its owner pool. */
async function runWorkerMatrix(input: WorkerMatrixInput): Promise<void> {
  progress(`starting ${input.workerCount}-worker pool`);
  const client = await P7ServiceClient.start(input.cliPath, input.workerCount);
  try {
    input.lifecycle.push({
      workers: input.workerCount,
      startupWallMs: client.startupWallMs,
      ready: client.readyStatus,
    });
    if (input.scope !== 'performance')
      await runEquivalence(
        client,
        input.rootPath,
        input.workerCount,
        input.correctnessCases,
        input.equivalence,
      );
    if (input.scope !== 'correctness')
      await runPerformance(
        client,
        input.rootPath,
        input.workerCount,
        input.performanceCases,
        input.runs,
        input.samples,
        progress,
      );
    input.lifecycle.push({
      workers: input.workerCount,
      afterMatrix: client.latestStatus(),
    });
  } finally {
    await client.stop();
  }
}

/**
 * Runs equivalence and returns its result.
 */
async function runEquivalence(
  client: P7ServiceClient,
  rootPath: string,
  workers: number,
  workloads: readonly Workload[],
  results: EquivalenceResult[],
): Promise<void> {
  for (const workload of workloads) {
    progress(`equivalence w${workers} ${workload.id}`);
    const classic = await client.request({
      kind: 'preview',
      filePath: workload.filePath,
      rootPath,
      engine: 'classic',
      occtTrace: true,
    });
    const parallel = await client.request({
      kind: 'preview',
      filePath: workload.filePath,
      rootPath,
      engine: 'parallel',
      occtTrace: true,
    });
    const classicContract = responseContract(classic.response);
    const parallelContract = responseContract(parallel.response);
    results.push({
      workers,
      workload: workload.id,
      classicHash: classicContract.hash,
      parallelHash: parallelContract.hash,
      match: classicContract.hash === parallelContract.hash,
    });
  }
}

/**
 * Handles load suite cases in the scripts parallel compilation flow.
 */
async function loadSuiteCases(rootPath: string): Promise<Workload[]> {
  const suitePath = resolve(rootPath, 'examples/test_suite/suite.json');
  const suite = JSON.parse(await readFile(suitePath, 'utf8')) as {
    cases: { id: string; file: string }[];
  };
  return suite.cases.map((entry) => ({
    id: entry.id,
    filePath: resolve(dirname(suitePath), entry.file),
    export: false,
  }));
}

/**
 * Handles performance workloads in the scripts parallel compilation flow.
 */
function performanceWorkloads(rootPath: string): Workload[] {
  const paths = [
    'examples/test_suite/13_module_library.bscd',
    'examples/test_suite/09_assembly_patterns.bscd',
    'examples/test_suite/04_solids_and_details.bscd',
    'examples/test_suite/12_imported_assets.bscd',
    'packages/cli/test/fixtures/parallel-components-p4-loft-benchmark.bscd',
    'packages/cli/test/fixtures/parallel-components-p5-reuse.bscd',
    'packages/cli/test/fixtures/parallel-p6-native-cut-benchmark.bscd',
  ];
  return paths.map((path) => ({
    id: basename(path, '.bscd'),
    filePath: resolve(rootPath, path),
    export: path.includes('09_assembly') || path.includes('p6-native-cut'),
  }));
}

/**
 * Handles positive integer in the scripts parallel compilation flow.
 */
function positiveInteger(value: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1)
    throw new Error(`Expected a positive integer, received '${value}'.`);
  return parsed;
}

/**
 * Reads arg from the supplied source.
 */
function readArg(name: string, fallback: string): string {
  const index = process.argv.indexOf(name);
  return index >= 0 ? (process.argv[index + 1] ?? fallback) : fallback;
}

/**
 * Handles progress in the scripts parallel compilation flow.
 */
function progress(message: string): void {
  process.stderr.write(`[P7] ${message}\n`);
}

void run().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.stack : String(error)}\n`,
  );
  process.exitCode = 1;
});
