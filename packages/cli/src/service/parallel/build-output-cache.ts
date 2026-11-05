/**
 * Optional disk cache for completed worker builds.
 *
 * Why: prepared component reuse still leaves final reductions and mesh
 * extraction to run. Caching the finished worker output lets an unchanged part
 * skip that work while keeping cache storage outside the compiler's RAM state.
 */

import type { OcctTraceEvent } from '@bushscad/ir';
import { completedBuildCacheIdentity } from './completed-build-cache-identity.js';
import type { PersistentOcctWorkerPool } from './persistent-worker-pool.js';
import type {
  ParallelBuildOutput,
  ParallelBuildTask,
} from './worker-protocol.js';
import {
  EMPTY_POOL_EXECUTION_METRICS,
  type PoolExecutionMetrics,
} from './pool-execution-metrics.js';

/** Stores final parallel worker outputs by exact output-affecting task identity. */
export interface CompletedBuildOutputCache {
  /** Loads the exact completed output for a cache identity. */
  get(
    digest: string,
    canonical: string,
  ): Promise<ParallelBuildOutput | undefined>;

  /** Persists a successful completed output when the storage policy allows it. */
  put(
    digest: string,
    canonical: string,
    output: ParallelBuildOutput,
  ): Promise<void>;
}

/** Reports worker outputs, output-cache hits, and only the work dispatched to OCCT. */
export type CachedBuildBatch = {
  outputs: ParallelBuildOutput[];
  cacheHitCount: number;
  execution: PoolExecutionMetrics;
};

/** Uses completed disk outputs where possible and dispatches the remaining tasks. */
export async function buildTasksWithOutputCache(
  tasks: readonly Omit<ParallelBuildTask, 'taskId'>[],
  pool: PersistentOcctWorkerPool,
  cache?: CompletedBuildOutputCache,
  onTrace?: (event: OcctTraceEvent) => void,
): Promise<CachedBuildBatch> {
  const outputs = new Array<ParallelBuildOutput>(tasks.length);
  const misses: Array<{
    index: number;
    task: Omit<ParallelBuildTask, 'taskId'>;
    digest: string;
    canonical: string;
  }> = [];
  let cacheHitCount = 0;

  for (const [index, task] of tasks.entries()) {
    if (!cache) {
      misses.push({ index, task, digest: '', canonical: '' });
      continue;
    }
    const identity = completedBuildCacheIdentity(task);
    const output = await readCachedOutput(
      cache,
      identity.digest,
      identity.canonical,
    );
    if (!output) {
      misses.push({ index, task, ...identity });
      continue;
    }
    const traceEvents = task.trace
      ? cachedBuildTrace(task, output.traceEvents)
      : [];
    outputs[index] = {
      ...output,
      taskId: 0,
      sourceIndex: task.sourceIndex,
      partName: task.partName,
      workerCpuMs: 0,
      workerRssBytes: 0,
      elapsedMs: 0,
      traceEvents,
    };
    cacheHitCount++;
    for (const event of traceEvents) onTrace?.(event);
  }

  if (misses.length === 0) {
    return {
      outputs,
      cacheHitCount,
      execution: EMPTY_POOL_EXECUTION_METRICS,
    };
  }

  const built = await pool.build(
    misses.map(({ task }) => task),
    onTrace,
  );
  const completedWrites: Promise<void>[] = [];
  for (const [missIndex, output] of built.entries()) {
    const miss = misses[missIndex];
    if (!miss) continue;
    outputs[miss.index] = output;
    if (cache) {
      completedWrites.push(
        writeCachedOutput(cache, miss.digest, miss.canonical, output),
      );
    }
  }
  await Promise.all(completedWrites);

  return {
    outputs,
    cacheHitCount,
    execution: pool.executionMetrics(),
  };
}

/** Reads a cache entry without allowing disk failures to break normal compilation. */
async function readCachedOutput(
  cache: CompletedBuildOutputCache,
  digest: string,
  canonical: string,
): Promise<ParallelBuildOutput | undefined> {
  try {
    return await cache.get(digest, canonical);
  } catch {
    return undefined;
  }
}

/** Stores a completed output opportunistically; cache failures remain build-neutral. */
async function writeCachedOutput(
  cache: CompletedBuildOutputCache,
  digest: string,
  canonical: string,
  output: ParallelBuildOutput,
): Promise<void> {
  try {
    await cache.put(digest, canonical, output);
  } catch {
    // Storage errors must leave the normal compiler result available.
  }
}

/** Rebuilds a current trace that clearly marks the worker geometry as skipped. */
function cachedBuildTrace(
  task: Omit<ParallelBuildTask, 'taskId'>,
  previousEvents: readonly OcctTraceEvent[],
): OcctTraceEvent[] {
  if (previousEvents.length > 0)
    return reusePreviousBuildTrace(task, previousEvents);
  return synthesizeCachedBuildTrace(task);
}

/** Re-tags stored lifecycle events as reused work in the current build. */
function reusePreviousBuildTrace(
  task: Omit<ParallelBuildTask, 'taskId'>,
  previousEvents: readonly OcctTraceEvent[],
): OcctTraceEvent[] {
  let timestampMs = Date.now();
  return previousEvents.map((event) => {
    const completedWork = isCompletedWorkEvent(event);
    return {
      ...event,
      timestampMs: timestampMs++,
      sourceIndex: task.sourceIndex,
      ...(event.elapsedMs !== undefined ? { elapsedMs: 0 } : {}),
      ...(event.cpuMs !== undefined ? { cpuMs: 0 } : {}),
      ...(completedWork ? { cacheHit: 'completed-build' as const } : {}),
      ...(completedWork
        ? { message: 'Reused completed build output from the session cache.' }
        : {}),
    };
  });
}

/** Creates cache-hit lifecycle rows for older entries without trace history. */
function synthesizeCachedBuildTrace(
  task: Omit<ParallelBuildTask, 'taskId'>,
): OcctTraceEvent[] {
  const events: OcctTraceEvent[] = [];
  const message = 'Reused completed build output from the session cache.';
  let timestampMs = Date.now();
  const append = (event: Omit<OcctTraceEvent, 'timestampMs'>): void => {
    events.push({
      timestampMs: timestampMs++,
      sourceIndex: task.sourceIndex,
      ...event,
    });
  };
  append({ kind: 'build-start', partName: task.partName, message });
  append({ kind: 'part-start', partName: task.partName, message });
  for (const op of task.program.ops) {
    if (op.kind === 'part') continue;
    const candidate = op as {
      name?: string;
      objName?: string;
      target?: string;
      sketchName?: string;
      fitName?: string;
    };
    const opName =
      candidate.objName ??
      candidate.name ??
      candidate.target ??
      candidate.sketchName ??
      candidate.fitName;
    append({
      kind: 'op-start',
      partName: task.partName,
      opKind: op.kind,
      ...(opName ? { opName } : {}),
      span: op.span,
      bodiesBefore: [],
      message,
      cacheHit: 'completed-build',
    });
    append({
      kind: 'op-success',
      partName: task.partName,
      opKind: op.kind,
      ...(opName ? { opName } : {}),
      span: op.span,
      elapsedMs: 0,
      bodiesBefore: [],
      bodiesAfter: [],
      message,
      cacheHit: 'completed-build',
    });
  }
  append({
    kind: 'part-success',
    partName: task.partName,
    elapsedMs: 0,
    message,
    cacheHit: 'completed-build',
  });
  append({
    kind: 'build-success',
    elapsedMs: 0,
    message,
    cacheHit: 'completed-build',
  });
  return events;
}

/** Identifies trace rows whose geometry work completed in a previous build. */
function isCompletedWorkEvent(event: OcctTraceEvent): boolean {
  return (
    event.kind === 'op-start' ||
    event.kind === 'op-success' ||
    event.kind === 'part-success' ||
    event.kind === 'build-success'
  );
}
