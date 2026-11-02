/**
 * @author Aidan Boissonneault
 * @file scheduler-dispatch.ts
 * @purpose Provides scheduler dispatch behavior for the pipeline parallel compilation in compiler package.
 * @last-edited October 6, 2026
 */

import type { CompilationGraph, CompilationGraphNode } from '@bushscad/ir';
import {
  analyzeSchedulerPriority,
  rankReadySchedulerNodes,
} from './scheduler-priority.js';
import { SchedulerResourceLocks } from './scheduler-resource-locks.js';
import type { MutableSchedulerMetrics } from './scheduler-result.js';
import type {
  SchedulerArtifact,
  SchedulerNodeStatus,
  SchedulerSimulationOptions,
  SchedulerTaskOutcome,
  SchedulerTaskRunner,
} from './scheduler-types.js';

/**
 * Type used for running scheduler task.
 */
export type RunningSchedulerTask = Readonly<{
  node: CompilationGraphNode;
  lane: 'geometry' | 'metadata';
  workerId?: string;
  promise: Promise<SchedulerTaskOutcome>;
}>;

/**
 * Type used for scheduler runtime analysis.
 */
export type SchedulerRuntimeAnalysis = Readonly<{
  ready: readonly CompilationGraphNode[];
  remaining: ReadonlyMap<string, number>;
}>;

/**
 * Type used for state for scheduler dispatch.
 */
export type SchedulerDispatchState = Readonly<{
  statuses: Map<string, SchedulerNodeStatus>;
  attempts: Map<string, number>;
  running: Map<string, RunningSchedulerTask>;
  locks: SchedulerResourceLocks;
  options: SchedulerSimulationOptions;
  runner: SchedulerTaskRunner;
  metadataConcurrency: number;
  metrics: MutableSchedulerMetrics;
}>;

/**
 * Type used for scheduler lease.
 */
type SchedulerLease = Readonly<{
  lane: 'geometry' | 'metadata';
  workerId?: string;
}>;

/** Finds ready nodes and orders them with the deterministic priority tuple. */
export function schedulerRuntimeAnalysis(
  graph: CompilationGraph,
  statuses: ReadonlyMap<string, SchedulerNodeStatus>,
  activeNodeIds?: ReadonlySet<string>,
): SchedulerRuntimeAnalysis {
  const remaining = new Map(graph.nodes.map((node) => [node.id, 0]));
  for (const edge of graph.edges) {
    if (statuses.get(edge.from) !== 'completed')
      remaining.set(edge.to, (remaining.get(edge.to) ?? 0) + 1);
  }
  const priority = analyzeSchedulerPriority(graph, activeNodeIds);
  return {
    ready: rankReadySchedulerNodes(
      graph.nodes.filter(
        (node) =>
          statuses.get(node.id) === 'pending' && remaining.get(node.id) === 0,
      ),
      priority,
      remaining,
    ),
    remaining,
  };
}

/** Publishes every currently ready safe cache hit without leasing a worker. */
export function completeSchedulerCacheHits(
  runtime: SchedulerRuntimeAnalysis,
  statuses: Map<string, SchedulerNodeStatus>,
  artifacts: Map<string, SchedulerArtifact>,
  cache: ReadonlyMap<string, unknown> | undefined,
  metrics: MutableSchedulerMetrics,
): boolean {
  if (!cache) return false;
  let changed = false;
  for (const node of runtime.ready) {
    const key = schedulerCacheKey(node, cache);
    if (!node.cacheSafe || !key) continue;
    statuses.set(node.id, 'completed');
    artifacts.set(node.id, {
      nodeId: node.id,
      value: cache.get(key),
      cacheHit: true,
    });
    metrics.cacheHitCount++;
    changed = true;
  }
  return changed;
}

/** Dispatches compatible ready tasks into independent metadata/geometry lanes. */
export function dispatchSchedulerTasks(
  runtime: SchedulerRuntimeAnalysis,
  state: SchedulerDispatchState,
): boolean {
  let dispatched = false;
  for (const node of runtime.ready) {
    if (
      state.statuses.get(node.id) !== 'pending' ||
      !state.locks.canAcquire(node)
    )
      continue;
    const lease = leaseSchedulerSlot(node, state);
    if (!lease) continue;
    startSchedulerTask(node, lease, state);
    dispatched = true;
  }
  return dispatched;
}

/**
 * Handles lease scheduler slot in the pipeline parallel compilation flow.
 */
function leaseSchedulerSlot(
  node: CompilationGraphNode,
  state: SchedulerDispatchState,
): SchedulerLease | undefined {
  const taskLane = schedulerLane(node);
  const laneCount = [...state.running.values()].filter(
    (task) => task.lane === taskLane,
  ).length;
  if (taskLane === 'metadata')
    return laneCount < state.metadataConcurrency
      ? { lane: taskLane }
      : undefined;
  if (laneCount >= state.metrics.effectiveWorkerCount) return undefined;
  const workerId = state.options.workerPool.acquire(node.id);
  return workerId ? { lane: taskLane, workerId } : undefined;
}

/**
 * Starts scheduler task with the supplied configuration.
 */
function startSchedulerTask(
  node: CompilationGraphNode,
  lease: SchedulerLease,
  state: SchedulerDispatchState,
): void {
  state.locks.acquire(node);
  state.statuses.set(node.id, 'running');
  const attempt = (state.attempts.get(node.id) ?? 0) + 1;
  state.attempts.set(node.id, attempt);
  const context = {
    node,
    attempt,
    ...(lease.workerId ? { workerId: lease.workerId } : {}),
    ...(state.options.signal ? { signal: state.options.signal } : {}),
  };
  state.running.set(node.id, {
    node,
    lane: lease.lane,
    ...(lease.workerId ? { workerId: lease.workerId } : {}),
    promise: Promise.resolve()
      .then(() => state.runner(context))
      .catch((error: unknown) => ({
        kind: 'failed' as const,
        message: error instanceof Error ? error.message : String(error),
      })),
  });
  state.metrics.dispatchedTaskCount++;
  updateConcurrencyMetrics(state.running, state.metrics);
}

/** Waits for the next fake runner completion without imposing finish order. */
export async function nextSchedulerSettlement(
  running: ReadonlyMap<string, RunningSchedulerTask>,
): Promise<readonly [string, SchedulerTaskOutcome]> {
  return Promise.race(
    [...running].map(
      async ([nodeId, task]) => <const>[nodeId, await task.promise],
    ),
  );
}

/**
 * Handles scheduler lane in the pipeline parallel compilation flow.
 */
export function schedulerLane(
  node: CompilationGraphNode,
): 'geometry' | 'metadata' {
  return node.estimatedCost === 'metadata' ? 'metadata' : 'geometry';
}

/**
 * Handles scheduler cache key in the pipeline parallel compilation flow.
 */
function schedulerCacheKey(
  node: CompilationGraphNode,
  cache: ReadonlyMap<string, unknown>,
): string | undefined {
  if (cache.has(node.id)) return node.id;
  if (node.recipeDigest && cache.has(node.recipeDigest))
    return node.recipeDigest;
  return undefined;
}

/**
 * Updates concurrency metrics while preserving unrelated state.
 */
function updateConcurrencyMetrics(
  running: ReadonlyMap<string, RunningSchedulerTask>,
  metrics: MutableSchedulerMetrics,
): void {
  const geometryCount = [...running.values()].filter(
    (task) => task.lane === 'geometry',
  ).length;
  metrics.maximumGeometryConcurrency = Math.max(
    metrics.maximumGeometryConcurrency,
    geometryCount,
  );
  metrics.maximumMetadataConcurrency = Math.max(
    metrics.maximumMetadataConcurrency,
    running.size - geometryCount,
  );
}
