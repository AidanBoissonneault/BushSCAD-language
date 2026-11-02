/**
 * @author Aidan Boissonneault
 * @file scheduler-capacity.ts
 * @purpose Provides scheduler capacity behavior for the pipeline parallel compilation in compiler package.
 * @last-edited October 6, 2026
 */

import type {
  SchedulerCapacity,
  SchedulerCapacityConfiguration,
} from './scheduler-types.js';

/** Validates a requested persistent pool size and computes its usable subset. */
export function validateSchedulerCapacity(
  configuration: SchedulerCapacityConfiguration,
): SchedulerCapacity {
  const issues: string[] = [];
  const {
    requestedWorkerCount,
    healthyWorkerCount,
    maximumWorkerCount,
    memoryPerWorkerMiB,
    memoryBudgetMiB,
  } = configuration;
  if (!positiveInteger(maximumWorkerCount))
    issues.push('Maximum worker count must be a positive integer.');
  if (!positiveInteger(requestedWorkerCount))
    issues.push('Requested worker count must be a positive integer.');
  else if (
    positiveInteger(maximumWorkerCount) &&
    requestedWorkerCount > maximumWorkerCount
  )
    issues.push(
      `Requested ${requestedWorkerCount} workers exceeds the tested maximum of ${maximumWorkerCount}.`,
    );
  if (!nonNegativeInteger(healthyWorkerCount))
    issues.push('Healthy worker count must be a non-negative integer.');
  else if (
    positiveInteger(requestedWorkerCount) &&
    healthyWorkerCount > requestedWorkerCount
  )
    issues.push('Healthy worker count cannot exceed the requested count.');
  if (!positiveFinite(memoryPerWorkerMiB))
    issues.push('Memory per worker must be a positive finite MiB value.');
  if (!positiveFinite(memoryBudgetMiB))
    issues.push('Worker memory budget must be a positive finite MiB value.');

  const memoryBoundWorkerCount =
    positiveFinite(memoryPerWorkerMiB) && positiveFinite(memoryBudgetMiB)
      ? Math.floor(memoryBudgetMiB / memoryPerWorkerMiB)
      : 0;
  if (
    positiveInteger(requestedWorkerCount) &&
    positiveFinite(memoryPerWorkerMiB) &&
    positiveFinite(memoryBudgetMiB) &&
    requestedWorkerCount > memoryBoundWorkerCount
  )
    issues.push(
      `Requested workers require ${requestedWorkerCount * memoryPerWorkerMiB} MiB, exceeding the ${memoryBudgetMiB} MiB budget.`,
    );
  const effectiveWorkerCount =
    issues.length === 0
      ? Math.min(
          requestedWorkerCount,
          healthyWorkerCount,
          maximumWorkerCount,
          memoryBoundWorkerCount,
        )
      : 0;
  return Object.freeze({
    ok: issues.length === 0,
    effectiveWorkerCount,
    memoryBoundWorkerCount,
    issues: Object.freeze(issues),
  });
}

/**
 * Handles positive integer in the pipeline parallel compilation flow.
 */
function positiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}

/**
 * Handles non negative integer in the pipeline parallel compilation flow.
 */
function nonNegativeInteger(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}

/**
 * Handles positive finite in the pipeline parallel compilation flow.
 */
function positiveFinite(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}
