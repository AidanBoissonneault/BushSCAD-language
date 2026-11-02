/**
 * @author Aidan Boissonneault
 * @file pool-execution-metrics.test.ts
 * @purpose Tests pool execution metrics behavior in the service in cli package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import {
  configuredPoolUtilization,
  mergePoolExecutionMetrics,
  PoolExecutionRecorder,
  type PoolExecutionMetrics,
} from '../../src/service/parallel/pool-execution-metrics.js';

describe('parallel pool execution metrics', () => {
  it('records worker-owned CPU, busy time, and coordinator overhead', () => {
    const recorder = new PoolExecutionRecorder();
    const dispatchedAt = recorder.dispatch();
    recorder.complete(dispatchedAt, {
      elapsedMs: 0,
      workerCpuMs: 12.5,
      workerRssBytes: 512,
    });

    const metrics = recorder.finish(2);
    expect(metrics.taskCount).toBe(1);
    expect(metrics.workerCpuMs).toBe(12.5);
    expect(metrics.workerBusyMs).toBe(0);
    expect(metrics.queueWaitMs).toBeGreaterThanOrEqual(0);
    expect(metrics.transportMs).toBeGreaterThanOrEqual(0);
    expect(metrics.workerUtilization).toBeGreaterThanOrEqual(0);
    expect(metrics.workerUtilization).toBeLessThanOrEqual(1);
  });

  it('merges sequential preparation and reduction phases', () => {
    const preparation = phase({
      taskCount: 4,
      wallMs: 100,
      workerBusyMs: 160,
      workerCpuMs: 140,
      queueWaitMs: 40,
      transportMs: 8,
      workerUtilization: 0.8,
      longestTaskMs: 45,
    });
    const reduction = phase({
      taskCount: 1,
      wallMs: 50,
      workerBusyMs: 40,
      workerCpuMs: 35,
      queueWaitMs: 0,
      transportMs: 2,
      workerUtilization: 0.8,
      longestTaskMs: 40,
    });

    expect(mergePoolExecutionMetrics([preparation, reduction])).toEqual({
      taskCount: 5,
      wallMs: 150,
      workerBusyMs: 200,
      workerCpuMs: 175,
      queueWaitMs: 40,
      transportMs: 10,
      workerUtilization: 0.8,
      longestTaskMs: 45,
    });
  });

  it('includes configured but idle owners in pool utilization', () => {
    expect(configuredPoolUtilization(100, 100, 1)).toBe(1);
    expect(configuredPoolUtilization(100, 100, 4)).toBe(0.25);
  });
});

/**
 * Handles phase in the service flow.
 */
function phase(metrics: PoolExecutionMetrics): PoolExecutionMetrics {
  return metrics;
}
