/**
 * @author Aidan Boissonneault
 * @file pool-execution-metrics.ts
 * @purpose Provides pool execution metrics behavior for the service parallel in cli package.
 * @last-edited October 6, 2026
 */

import type { ParallelWorkerTelemetry } from './worker-protocol.js';

/**
 * Type used for measurements for pool execution.
 */
export type PoolExecutionMetrics = Readonly<{
  taskCount: number;
  wallMs: number;
  workerBusyMs: number;
  workerCpuMs: number;
  queueWaitMs: number;
  transportMs: number;
  workerUtilization: number;
  longestTaskMs: number;
}>;

export const EMPTY_POOL_EXECUTION_METRICS: PoolExecutionMetrics = {
  taskCount: 0,
  wallMs: 0,
  workerBusyMs: 0,
  workerCpuMs: 0,
  queueWaitMs: 0,
  transportMs: 0,
  workerUtilization: 0,
  longestTaskMs: 0,
};

/**
 * Derives `MeasuredOutput` from `ParallelWorkerTelemetry & { elapsedMs: number }` to preserve its type
 * relationship in the service parallel layer.
 */
type MeasuredOutput = ParallelWorkerTelemetry & { elapsedMs: number };

/** Records coordinator and worker timing for one pool scheduling phase. */
export class PoolExecutionRecorder {
  private readonly startedAtMs = performance.now();
  private workerBusyMs = 0;
  private workerCpuMs = 0;
  private queueWaitMs = 0;
  private transportMs = 0;
  private longestTaskMs = 0;
  private completedTasks = 0;

  /** Marks dispatch after any time the task spent queued behind prior work. */
  dispatch(): number {
    const dispatchedAtMs = performance.now();
    this.queueWaitMs += dispatchedAtMs - this.startedAtMs;
    return dispatchedAtMs;
  }

  /** Combines worker-owned measurements with coordinator round-trip time. */
  complete(dispatchedAtMs: number, output: MeasuredOutput): void {
    const roundTripMs = performance.now() - dispatchedAtMs;
    this.completedTasks++;
    this.workerBusyMs += output.elapsedMs;
    this.workerCpuMs += output.workerCpuMs;
    this.transportMs += Math.max(0, roundTripMs - output.elapsedMs);
    this.longestTaskMs = Math.max(this.longestTaskMs, output.elapsedMs);
  }

  /** Produces a stable snapshot even when a failed phase completes no task. */
  finish(workerCount: number): PoolExecutionMetrics {
    const wallMs = performance.now() - this.startedAtMs;
    return {
      taskCount: this.completedTasks,
      wallMs,
      workerBusyMs: this.workerBusyMs,
      workerCpuMs: this.workerCpuMs,
      queueWaitMs: this.queueWaitMs,
      transportMs: this.transportMs,
      workerUtilization: configuredPoolUtilization(
        this.workerBusyMs,
        wallMs,
        workerCount,
      ),
      longestTaskMs: this.longestTaskMs,
    };
  }
}

/** Measures busy time against every configured owner, including idle workers. */
export function configuredPoolUtilization(
  workerBusyMs: number,
  wallMs: number,
  workerCount: number,
): number {
  return Math.min(
    1,
    workerBusyMs / Math.max(1, wallMs * Math.max(1, workerCount)),
  );
}

/** Merges sequential pool phases without overstating their utilization. */
export function mergePoolExecutionMetrics(
  phases: readonly PoolExecutionMetrics[],
): PoolExecutionMetrics {
  const totals = phases.reduce(
    (sum, phase) => ({
      taskCount: sum.taskCount + phase.taskCount,
      wallMs: sum.wallMs + phase.wallMs,
      workerBusyMs: sum.workerBusyMs + phase.workerBusyMs,
      workerCpuMs: sum.workerCpuMs + phase.workerCpuMs,
      queueWaitMs: sum.queueWaitMs + phase.queueWaitMs,
      transportMs: sum.transportMs + phase.transportMs,
      longestTaskMs: Math.max(sum.longestTaskMs, phase.longestTaskMs),
      weightedUtilization:
        sum.weightedUtilization + phase.workerUtilization * phase.wallMs,
    }),
    {
      taskCount: 0,
      wallMs: 0,
      workerBusyMs: 0,
      workerCpuMs: 0,
      queueWaitMs: 0,
      transportMs: 0,
      longestTaskMs: 0,
      weightedUtilization: 0,
    },
  );
  return {
    taskCount: totals.taskCount,
    wallMs: totals.wallMs,
    workerBusyMs: totals.workerBusyMs,
    workerCpuMs: totals.workerCpuMs,
    queueWaitMs: totals.queueWaitMs,
    transportMs: totals.transportMs,
    workerUtilization: totals.weightedUtilization / Math.max(1, totals.wallMs),
    longestTaskMs: totals.longestTaskMs,
  };
}
