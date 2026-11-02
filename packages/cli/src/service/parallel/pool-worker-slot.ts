/**
 * @author Aidan Boissonneault
 * @file pool-worker-slot.ts
 * @purpose Provides pool worker slot behavior for the service parallel in cli package.
 * @last-edited October 6, 2026
 */

import type { ChildProcess } from 'node:child_process';
import type { OcctTraceEvent } from '@bushscad/ir';
import type {
  ParallelBuildOutput,
  ParallelComponentOutput,
  ParallelExportOutput,
  ParallelPoolStatus,
} from './worker-protocol.js';

/**
 * Output from pool task accepts ParallelBuildOutput, ParallelComponentOutput, and
 * ParallelExportOutput.
 */
export type PoolTaskOutput =
  | ParallelBuildOutput
  | ParallelComponentOutput
  | ParallelExportOutput;

/**
 * Pending pool task, including task id, source index, promise resolution callback, promise
 * rejection callback, and on trace.
 */
export type PendingPoolTask = {
  taskId: number;
  sourceIndex?: number;
  resolve: (output: PoolTaskOutput) => void;
  reject: (error: Error) => void;
  onTrace?: (event: OcctTraceEvent) => void;
};

/**
 * Worker slot, including identifier, process, current state, startup duration, and resident
 * memory.
 */
export type WorkerSlot = {
  id: number;
  process: ChildProcess;
  state: 'warming' | 'ready' | 'busy' | 'failed';
  startupMs: number;
  rssBytes: number;
  pending?: PendingPoolTask;
};

/** Derives the public lifecycle state from the current worker counts. */
export function poolState(
  disposed: boolean,
  desired: number,
  ready: number,
  warming: number,
  busy: number,
  failed: number,
): ParallelPoolStatus['state'] {
  if (disposed) return 'stopped';
  if (busy > 0) return 'busy';
  if (warming > 0) return 'warming';
  if (ready === desired) return 'ready';
  if (ready > 0 || failed > 0) return 'degraded';
  return 'failed';
}
