/**
 * @author Aidan Boissonneault
 * @file pool-status.ts
 * @purpose Provides pool status behavior for the service parallel in cli package.
 * @last-edited October 6, 2026
 */

import type { ParallelPoolStatus } from './worker-protocol.js';
import { poolState, type WorkerSlot } from './pool-worker-slot.js';

/** Builds the public pool snapshot from private worker lifecycle state. */
export function createPoolStatus(
  slots: readonly WorkerSlot[],
  disposed: boolean,
  desiredWorkers: number,
  peakAggregateWorkerRssBytes: number,
): ParallelPoolStatus {
  /**
   * Handles count in the service parallel flow.
   */
  const count = (state: WorkerSlot['state']): number =>
    slots.filter((slot) => slot.state === state).length;
  const readyWorkers = count('ready');
  const warmingWorkers = count('warming');
  const busyWorkers = count('busy');
  const failedWorkers = count('failed');
  return {
    state: poolState(
      disposed,
      desiredWorkers,
      readyWorkers,
      warmingWorkers,
      busyWorkers,
      failedWorkers,
    ),
    desiredWorkers,
    warmingWorkers,
    readyWorkers,
    busyWorkers,
    failedWorkers,
    startupMs: Math.max(0, ...slots.map((slot) => slot.startupMs)),
    aggregateWorkerRssBytes: slots.reduce(
      (total, slot) => total + slot.rssBytes,
      0,
    ),
    peakAggregateWorkerRssBytes,
  };
}
