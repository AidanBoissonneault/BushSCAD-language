/**
 * @author Aidan Boissonneault
 * @file scheduler-trace-identity.ts
 * @purpose Provides scheduler trace identity behavior for the service tracing in cli package.
 * @last-edited October 6, 2026
 */

import type { OcctTraceEvent } from '@bushscad/ir';
import type { WorkerSlot } from '../parallel/pool-worker-slot.js';

/**
 * Scheduler trace identity, including task id, worker id, and source index.
 */
export type SchedulerTraceIdentity = {
  taskId: number;
  workerId: number;
  sourceIndex?: number;
};

/**
 * Adds only identity known by the persistent pool scheduler.
 *
 * Why: worker lanes must use the slot that actually owned the task instead of
 * guessing concurrency from the order in which child messages arrive.
 */
export function attachSchedulerTraceIdentity(
  event: OcctTraceEvent,
  identity: SchedulerTraceIdentity,
): OcctTraceEvent {
  return {
    ...event,
    taskId: `task-${identity.taskId}`,
    workerId: `worker-${identity.workerId}`,
    ...(identity.sourceIndex === undefined
      ? {}
      : { sourceIndex: identity.sourceIndex }),
  };
}

/** Forwards trace data only through the scheduler slot that owns the task. */
export function forwardSchedulerTrace(
  slot: WorkerSlot,
  taskId: number,
  event: OcctTraceEvent,
): void {
  const pending = slot.pending;
  if (pending?.taskId !== taskId) return;
  pending.onTrace?.(
    attachSchedulerTraceIdentity(event, {
      taskId,
      workerId: slot.id,
      sourceIndex: pending.sourceIndex,
    }),
  );
}
