/**
 * @author Aidan Boissonneault
 * @file classic-benchmark.ts
 * @purpose Provides classic benchmark behavior for the scripts parallel compilation in repository tooling.
 * @last-edited October 6, 2026
 */

import { resolve } from 'node:path';
import { compileFileToIr, previewFile } from '@bushscad/compiler/node';
import type { MeshData, OcctTraceEvent } from '@bushscad/ir';
import { writeJsonReport } from './report-output.js';

/**
 * Runtime and resource readings captured around a benchmark operation, including wall time, CPU
 * use, and resident memory before and after.
 */
type Measurement = {
  wallMs: number;
  cpuUserMs: number;
  cpuSystemMs: number;
  rssBeforeBytes: number;
  rssAfterBytes: number;
  maxRssBytes: number;
};

/** Captures classic check plus cold and warm preview costs without changing production routing. */
async function run(): Promise<void> {
  const filePath = resolve(readArg('--file'));
  const outPath = resolve(
    readArg(
      '--out',
      '.bushscad-analysis/parallel-compilation/p0-classic-benchmark.json',
    ),
  );

  const check = measureSync(() => compileFileToIr({ filePath }));
  if (!check.value.ok) throw new Error(check.value.errors[0]?.message);

  const cold = await measureAsync(() =>
    previewFile({ filePath, occtTrace: true }),
  );
  if (!cold.value.ok) throw new Error(cold.value.errors[0]?.message);

  const warm = await measureAsync(() =>
    previewFile({ filePath, occtTrace: true }),
  );
  if (!warm.value.ok) throw new Error(warm.value.errors[0]?.message);

  const report = {
    generatedAt: new Date().toISOString(),
    filePath,
    node: process.version,
    check: {
      measurement: check.measurement,
      compilerElapsedMs: check.value.elapsedMs,
      operationCount: check.value.program.ops.length,
    },
    coldPreview: previewSummary(
      cold.measurement,
      cold.value.elapsedMs,
      cold.value.meshes,
      cold.value.occtTraceEvents,
    ),
    warmPreview: previewSummary(
      warm.measurement,
      warm.value.elapsedMs,
      warm.value.meshes,
      warm.value.occtTraceEvents,
    ),
  };
  await writeJsonReport(outPath, report);
}

/**
 * Handles preview summary in the scripts parallel compilation flow.
 */
function previewSummary(
  measurement: Measurement,
  compilerElapsedMs: number,
  meshes: MeshData[],
  events: OcctTraceEvent[] | undefined,
): unknown {
  return {
    measurement,
    compilerElapsedMs,
    meshCount: meshes.length,
    triangleCount: meshes.reduce(
      (total, mesh) => total + mesh.indices.length / 3,
      0,
    ),
    trace: (events ?? [])
      .filter((event) => event.elapsedMs !== undefined)
      .map(({ kind, partName, opKind, opName, elapsedMs }) => ({
        kind,
        partName,
        opKind,
        opName,
        elapsedMs,
      })),
  };
}

/**
 * Handles measure sync in the scripts parallel compilation flow.
 */
function measureSync<T>(work: () => T): { value: T; measurement: Measurement } {
  const startedAt = performance.now();
  const startedCpu = process.cpuUsage();
  const rssBeforeBytes = process.memoryUsage().rss;
  const value = work();
  return {
    value,
    measurement: finishMeasurement(startedAt, startedCpu, rssBeforeBytes),
  };
}

/**
 * Handles measure async in the scripts parallel compilation flow.
 */
async function measureAsync<T>(
  work: () => Promise<T>,
): Promise<{ value: T; measurement: Measurement }> {
  const startedAt = performance.now();
  const startedCpu = process.cpuUsage();
  const rssBeforeBytes = process.memoryUsage().rss;
  const value = await work();
  return {
    value,
    measurement: finishMeasurement(startedAt, startedCpu, rssBeforeBytes),
  };
}

/**
 * Completes measurement and records its final state.
 */
function finishMeasurement(
  startedAt: number,
  startedCpu: NodeJS.CpuUsage,
  rssBeforeBytes: number,
): Measurement {
  const cpu = process.cpuUsage(startedCpu);
  return {
    wallMs: performance.now() - startedAt,
    cpuUserMs: cpu.user / 1_000,
    cpuSystemMs: cpu.system / 1_000,
    rssBeforeBytes,
    rssAfterBytes: process.memoryUsage().rss,
    maxRssBytes: process.resourceUsage().maxRSS * 1_024,
  };
}

/**
 * Reads arg from the supplied source.
 */
function readArg(name: string, fallback?: string): string {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : fallback;
  if (!value) throw new Error(`Missing required ${name} argument.`);
  return value;
}

void run().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
  );
  process.exitCode = 1;
});
