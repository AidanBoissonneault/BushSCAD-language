/**
 * @author Aidan Boissonneault
 * @file p7-performance-runner.ts
 * @purpose Provides p7 performance runner behavior for the scripts parallel compilation in repository tooling.
 * @last-edited October 6, 2026
 */

import { readFile } from 'node:fs/promises';
import type { BenchmarkSample } from './p7-benchmark-summary.js';
import {
  type Engine,
  P7ServiceClient,
  type ServiceResult,
} from './p7-service-client.js';

/**
 * One benchmark workload, identified by its ID and source file, with an export toggle.
 */
export type Workload = {
  id: string;
  filePath: string;
  export: boolean;
};

/** Runs repeated, order-balanced preview, incremental, and export samples. */
export async function runPerformance(
  client: P7ServiceClient,
  rootPath: string,
  workers: number,
  workloads: readonly Workload[],
  runs: number,
  samples: BenchmarkSample[],
  progress: (message: string) => void,
): Promise<void> {
  for (const workload of workloads)
    await runWorkload(
      client,
      rootPath,
      workers,
      workload,
      runs,
      samples,
      progress,
    );
}

/**
 * Runs workload and returns its result.
 */
async function runWorkload(
  client: P7ServiceClient,
  rootPath: string,
  workers: number,
  workload: Workload,
  runs: number,
  samples: BenchmarkSample[],
  progress: (message: string) => void,
): Promise<void> {
  const source = await readFile(workload.filePath, 'utf8');
  for (let round = 0; round < runs; round++)
    await runRound(
      client,
      rootPath,
      workers,
      workload,
      source,
      round,
      samples,
      progress,
    );
}

/**
 * Runs round and returns its result.
 */
async function runRound(
  client: P7ServiceClient,
  rootPath: string,
  workers: number,
  workload: Workload,
  source: string,
  round: number,
  samples: BenchmarkSample[],
  progress: (message: string) => void,
): Promise<void> {
  for (const engine of engineOrder(round))
    await sampleEngine(
      client,
      rootPath,
      workers,
      workload,
      source,
      round,
      engine,
      samples,
      progress,
    );
}

/**
 * Handles sample engine in the scripts parallel compilation flow.
 */
async function sampleEngine(
  client: P7ServiceClient,
  rootPath: string,
  workers: number,
  workload: Workload,
  source: string,
  round: number,
  engine: Engine,
  samples: BenchmarkSample[],
  progress: (message: string) => void,
): Promise<void> {
  progress(`preview w${workers} ${workload.id} ${engine} r${round + 1}`);
  samples.push(await takeSample(client, rootPath, workload, engine, 'preview'));
  samples.push(
    await takeSample(client, rootPath, workload, engine, 'incremental', {
      [workload.filePath]: `${source}\n// P7 incremental ${round}\n`,
    }),
  );
  if (!workload.export) return;
  progress(`export w${workers} ${workload.id} ${engine} r${round + 1}`);
  samples.push(await takeSample(client, rootPath, workload, engine, 'export'));
}

/**
 * Handles take sample in the scripts parallel compilation flow.
 */
async function takeSample(
  client: P7ServiceClient,
  rootPath: string,
  workload: Workload,
  engine: Engine,
  phase: BenchmarkSample['phase'],
  overlays?: Record<string, string>,
): Promise<BenchmarkSample> {
  const exporting = phase === 'export';
  const { response, wallMs } = await client.request({
    kind: exporting ? 'export' : 'preview',
    filePath: workload.filePath,
    rootPath,
    engine,
    occtTrace: !exporting,
    ...(overlays ? { overlays } : {}),
    ...(exporting ? { format: 'step' as const } : {}),
  });
  requireSuccess(response, workload, engine, phase);
  return {
    workers: client.readyStatus.desiredWorkers,
    workload: workload.id,
    engine,
    phase,
    wallMs,
    compilerElapsedMs: response.elapsedMs,
    metrics: response.compilerMetrics,
    trace: records(response.occtTraceEvents),
  };
}

/**
 * Handles engine order in the scripts parallel compilation flow.
 */
function engineOrder(round: number): Engine[] {
  return round % 2 === 0 ? ['classic', 'parallel'] : ['parallel', 'classic'];
}

/**
 * Handles require success in the scripts parallel compilation flow.
 */
function requireSuccess(
  response: ServiceResult,
  workload: Workload,
  engine: Engine,
  phase: string,
): void {
  if (response.ok) return;
  throw new Error(
    `${workload.id} ${engine} ${phase} failed: ${JSON.stringify(response)}`,
  );
}

/**
 * Handles records in the scripts parallel compilation flow.
 */
function records(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (entry): entry is Record<string, unknown> =>
      typeof entry === 'object' && entry !== null,
  );
}
