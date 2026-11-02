/**
 * @author Aidan Boissonneault
 * @file p7-benchmark-summary.ts
 * @purpose Summarizes parallel compiler benchmark samples by workload, engine, and phase.
 * @last-edited October 6, 2026
 */

/**
 * One timing sample for a benchmark workload and phase, with the chosen engine and any compiler
 * metrics or trace.
 */

export type BenchmarkSample = {
  workers: number;
  workload: string;
  engine: 'classic' | 'parallel';
  phase: 'preview' | 'incremental' | 'export';
  wallMs: number;
  compilerElapsedMs: number;
  metrics?: Record<string, unknown>;
  trace: Record<string, unknown>[];
};

/**
 * Wall-clock and CPU durations recorded for an operation.
 */
type OperationTiming = { elapsedMs: number[]; cpuMs: number[] };

/** Groups raw samples and reports robust latency plus resource statistics. */
export function summarizeSamples(
  samples: readonly BenchmarkSample[],
): unknown[] {
  const groups = new Map<string, BenchmarkSample[]>();
  for (const sample of samples) {
    const key = [
      sample.workers,
      sample.workload,
      sample.engine,
      sample.phase,
    ].join('|');
    groups.set(key, [...(groups.get(key) ?? []), sample]);
  }
  return [...groups.values()].map((group) => {
    const first = group[0];
    return {
      workers: first.workers,
      workload: first.workload,
      engine: first.engine,
      phase: first.phase,
      samples: group.length,
      wallMs: statistics(group.map((sample) => sample.wallMs)),
      compilerElapsedMs: statistics(
        group.map((sample) => sample.compilerElapsedMs),
      ),
      workerCpuMs: statistics(metricValues(group, 'workerCpuMs')),
      workerBusyMs: statistics(metricValues(group, 'workerBusyMs')),
      queueWaitMs: statistics(metricValues(group, 'queueWaitMs')),
      transportMs: statistics(metricValues(group, 'transportMs')),
      workerUtilization: statistics(metricValues(group, 'workerUtilization')),
      peakWorkerRssBytes: Math.max(
        0,
        ...metricValues(group, 'peakWorkerRssBytes'),
      ),
      schedulerTaskCount: statistics(metricValues(group, 'schedulerTaskCount')),
      longestWorkerTaskMs: statistics(
        metricValues(group, 'longestWorkerTaskMs'),
      ),
      nativeBooleanBatchCount: statistics(
        metricValues(group, 'nativeBooleanBatchCount'),
      ),
      operationTimings: operationTimings(group),
    };
  });
}

/**
 * Handles statistics in the scripts parallel compilation flow.
 */
function statistics(values: readonly number[]): unknown {
  if (values.length === 0) return undefined;
  const sorted = [...values].sort((left, right) => left - right);
  return {
    median: percentile(sorted, 0.5),
    p95: percentile(sorted, 0.95),
    min: sorted[0],
    max: sorted.at(-1),
  };
}

/**
 * Handles percentile in the scripts parallel compilation flow.
 */
function percentile(sorted: readonly number[], fraction: number): number {
  return sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)] ?? 0;
}

/**
 * Handles metric values in the scripts parallel compilation flow.
 */
function metricValues(
  samples: readonly BenchmarkSample[],
  name: string,
): number[] {
  return samples.flatMap((sample) => {
    const value = sample.metrics?.[name];
    return typeof value === 'number' ? [value] : [];
  });
}

/**
 * Dispatches the operation to its matching action handler.
 */
function operationTimings(samples: readonly BenchmarkSample[]): unknown[] {
  const timings = new Map<string, OperationTiming>();
  for (const event of samples.flatMap((sample) => sample.trace))
    recordOperationTiming(timings, event);
  return [...timings.entries()].map(([operation, values]) => ({
    operation,
    elapsedMs: statistics(values.elapsedMs),
    cpuMs: statistics(values.cpuMs),
  }));
}

/** Adds only timed OCCT operation completions to the grouped report. */
function recordOperationTiming(
  timings: Map<string, OperationTiming>,
  event: Record<string, unknown>,
): void {
  if (!isTimedOperation(event.kind)) return;
  const name = operationName(event);
  const timing = timings.get(name) ?? { elapsedMs: [], cpuMs: [] };
  appendNumber(timing.elapsedMs, event.elapsedMs);
  appendNumber(timing.cpuMs, event.cpuMs);
  timings.set(name, timing);
}

/**
 * Returns whether the input meets the `timed operation` condition.
 */
function isTimedOperation(kind: unknown): boolean {
  return kind === 'op-success' || kind === 'native-boolean-batch';
}

/**
 * Dispatches the operation to its matching action handler.
 */
function operationName(event: Record<string, unknown>): string {
  return String(event.opKind ?? event.kind);
}

/**
 * Appends number to the current output.
 */
function appendNumber(values: number[], value: unknown): void {
  if (typeof value === 'number') values.push(value);
}
