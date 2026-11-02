/**
 * @author Aidan Boissonneault
 * @file simulate-compilation-schedule.ts
 * @purpose Provides simulate compilation schedule behavior for the pipeline parallel compilation in compiler package.
 * @last-edited October 6, 2026
 */

import type { CompilationGraph } from '@bushscad/ir';
import {
  completeSchedulerCacheHits,
  dispatchSchedulerTasks,
  nextSchedulerSettlement,
  schedulerRuntimeAnalysis,
  type RunningSchedulerTask,
} from './scheduler-dispatch.js';
import { settleSchedulerOutcome } from './scheduler-outcomes.js';
import {
  schedulerPreflight,
  SCHEDULER_FALLBACK_SPAN,
} from './scheduler-preflight.js';
import { SchedulerResourceLocks } from './scheduler-resource-locks.js';
import {
  schedulerResult,
  type MutableSchedulerMetrics,
} from './scheduler-result.js';
import type {
  SchedulerArtifact,
  SchedulerError,
  SchedulerNodeStatus,
  SchedulerSimulationOptions,
  SchedulerSimulationResult,
  SchedulerTaskRunner,
} from './scheduler-types.js';

/**
 * Type used for state for scheduler loop.
 */
type SchedulerLoopState = Readonly<{
  statuses: Map<string, SchedulerNodeStatus>;
  attempts: Map<string, number>;
  artifacts: Map<string, SchedulerArtifact>;
  errors: SchedulerError[];
  running: Map<string, RunningSchedulerTask>;
  locks: SchedulerResourceLocks;
  options: SchedulerSimulationOptions;
  runner: SchedulerTaskRunner;
  metadataConcurrency: number;
  metrics: MutableSchedulerMetrics;
}>;

/** Simulates dependency-driven parallel execution with an injected fake runner. */
export async function simulateCompilationSchedule(
  initialGraph: CompilationGraph,
  options: SchedulerSimulationOptions,
  runner: SchedulerTaskRunner,
): Promise<SchedulerSimulationResult> {
  let graph = initialGraph;
  const statuses = new Map<string, SchedulerNodeStatus>(
    graph.nodes.map((node) => [node.id, 'pending']),
  );
  const attempts = new Map<string, number>();
  const artifacts = new Map<string, SchedulerArtifact>();
  const errors: SchedulerError[] = [];
  const running = new Map<string, RunningSchedulerTask>();
  const locks = new SchedulerResourceLocks();
  const metadataConcurrency = options.metadataConcurrency ?? 1;
  const preflight = schedulerPreflight(graph, options, metadataConcurrency);
  errors.push(...preflight.errors);
  const metrics: MutableSchedulerMetrics = {
    dispatchedTaskCount: 0,
    cacheHitCount: 0,
    continuationCount: 0,
    maximumGeometryConcurrency: 0,
    maximumMetadataConcurrency: 0,
    effectiveWorkerCount: preflight.capacity.effectiveWorkerCount,
  };
  if (errors.length > 0) {
    cancelPending(statuses);
    return schedulerResult(
      graph,
      statuses,
      attempts,
      artifacts,
      errors,
      metrics,
      options.workerPool,
      false,
    );
  }
  const state: SchedulerLoopState = {
    statuses,
    attempts,
    artifacts,
    errors,
    running,
    locks,
    options,
    runner,
    metadataConcurrency,
    metrics,
  };
  while (unfinished(statuses)) {
    graph = await runSchedulerIteration(graph, state);
  }

  return schedulerResult(
    graph,
    statuses,
    attempts,
    artifacts,
    errors,
    metrics,
    options.workerPool,
    Boolean(options.signal?.aborted),
  );
}

/**
 * Runs scheduler iteration and returns its result.
 */
async function runSchedulerIteration(
  graph: CompilationGraph,
  state: SchedulerLoopState,
): Promise<CompilationGraph> {
  if (state.options.signal?.aborted) cancelPending(state.statuses);
  const progressed = prepareReadyTasks(graph, state);
  if (state.running.size === 0) {
    handleIdleScheduler(graph, state, progressed);
    return graph;
  }
  const [nodeId, outcome] = await nextSchedulerSettlement(state.running);
  return settleSchedulerOutcome(graph, nodeId, outcome, state);
}

/**
 * Prepares ready tasks for the next operation.
 */
function prepareReadyTasks(
  graph: CompilationGraph,
  state: SchedulerLoopState,
): boolean {
  let runtime = schedulerRuntimeAnalysis(
    graph,
    state.statuses,
    state.options.activeNodeIds,
  );
  let cacheProgress = false;
  while (
    completeSchedulerCacheHits(
      runtime,
      state.statuses,
      state.artifacts,
      state.options.cachedArtifacts,
      state.metrics,
    )
  ) {
    cacheProgress = true;
    runtime = schedulerRuntimeAnalysis(
      graph,
      state.statuses,
      state.options.activeNodeIds,
    );
  }
  return dispatchSchedulerTasks(runtime, state) || cacheProgress;
}

/**
 * Handles idle scheduler in the current pipeline parallel compilation flow.
 */
function handleIdleScheduler(
  graph: CompilationGraph,
  state: SchedulerLoopState,
  progressed: boolean,
): void {
  if (!unfinished(state.statuses) || progressed) return;
  recordStalledTasks(graph, state.statuses, state.errors);
  cancelPending(state.statuses);
}

/**
 * Handles record stalled tasks in the pipeline parallel compilation flow.
 */
function recordStalledTasks(
  graph: CompilationGraph,
  statuses: ReadonlyMap<string, SchedulerNodeStatus>,
  errors: SchedulerError[],
): void {
  const stalled = graph.nodes.filter(
    (node) => statuses.get(node.id) === 'pending',
  );
  errors.push(
    ...stalled.map((node) => ({
      code: 'stalled' as const,
      message: `Task '${node.id}' cannot acquire its dependencies or resources.`,
      nodeId: node.id,
      span: node.span ?? SCHEDULER_FALLBACK_SPAN,
    })),
  );
}

/**
 * Cancels pending and restores the prior state.
 */
function cancelPending(statuses: Map<string, SchedulerNodeStatus>): void {
  for (const [nodeId, status] of statuses)
    if (status === 'pending') statuses.set(nodeId, 'cancelled');
}

/**
 * Handles unfinished in the pipeline parallel compilation flow.
 */
function unfinished(
  statuses: ReadonlyMap<string, SchedulerNodeStatus>,
): boolean {
  return [...statuses.values()].some((status) =>
    ['pending', 'running'].includes(status),
  );
}
