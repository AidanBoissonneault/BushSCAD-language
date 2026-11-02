/**
 * @author Aidan Boissonneault
 * @file compiler-execution-metrics.ts
 * @purpose Provides compiler execution metrics behavior for the service parallel in cli package.
 * @last-edited October 6, 2026
 */

import type { CompilerMetrics } from '../../dto/types.js';
import type { PersistentOcctWorkerPool } from './persistent-worker-pool.js';
import type { PoolExecutionMetrics } from './pool-execution-metrics.js';

/**
 * Type used for execution metric fields.
 */
type ExecutionMetricFields = Pick<
  CompilerMetrics,
  | 'schedulerTaskCount'
  | 'workerBusyMs'
  | 'workerCpuMs'
  | 'queueWaitMs'
  | 'transportMs'
  | 'workerUtilization'
  | 'longestWorkerTaskMs'
  | 'aggregateWorkerRssBytes'
  | 'peakWorkerRssBytes'
>;

/** Maps pool-owned measurements onto the stable service metrics contract. */
export function compilerExecutionMetrics(
  pool: PersistentOcctWorkerPool,
  execution: PoolExecutionMetrics,
): ExecutionMetricFields {
  const status = pool.snapshot();
  return {
    schedulerTaskCount: execution.taskCount,
    workerBusyMs: execution.workerBusyMs,
    workerCpuMs: execution.workerCpuMs,
    queueWaitMs: execution.queueWaitMs,
    transportMs: execution.transportMs,
    workerUtilization: execution.workerUtilization,
    longestWorkerTaskMs: execution.longestTaskMs,
    aggregateWorkerRssBytes: status.aggregateWorkerRssBytes,
    peakWorkerRssBytes: status.peakAggregateWorkerRssBytes,
  };
}
