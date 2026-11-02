/**
 * @author Aidan Boissonneault
 * @file scheduler-outcomes.ts
 * @purpose Provides scheduler outcomes behavior for the pipeline parallel compilation in compiler package.
 * @last-edited October 6, 2026
 */

import type { CompilationGraph, CompilationGraphNode } from '@bushscad/ir';
import { applySchedulerContinuation } from './scheduler-continuations.js';
import type { RunningSchedulerTask } from './scheduler-dispatch.js';
import { SCHEDULER_FALLBACK_SPAN } from './scheduler-preflight.js';
import { SchedulerResourceLocks } from './scheduler-resource-locks.js';
import type { MutableSchedulerMetrics } from './scheduler-result.js';
import type {
  SchedulerArtifact,
  SchedulerError,
  SchedulerNodeStatus,
  SchedulerSimulationOptions,
  SchedulerTaskOutcome,
} from './scheduler-types.js';

/**
 * Type used for state for scheduler outcome.
 */
export type SchedulerOutcomeState = Readonly<{
  statuses: Map<string, SchedulerNodeStatus>;
  artifacts: Map<string, SchedulerArtifact>;
  errors: SchedulerError[];
  running: Map<string, RunningSchedulerTask>;
  locks: SchedulerResourceLocks;
  options: SchedulerSimulationOptions;
  metrics: MutableSchedulerMetrics;
}>;

/** Publishes one settled task and returns the graph after any continuation. */
export function settleSchedulerOutcome(
  graph: CompilationGraph,
  nodeId: string,
  outcome: SchedulerTaskOutcome,
  state: SchedulerOutcomeState,
): CompilationGraph {
  const task = state.running.get(nodeId);
  if (!task) return graph;
  state.running.delete(nodeId);
  state.locks.release(task.node);
  if (task.workerId) state.options.workerPool.release(task.workerId);
  if (state.options.signal?.aborted) {
    state.statuses.set(nodeId, 'cancelled');
    return graph;
  }
  if (outcome.kind === 'completed') {
    completeTask(nodeId, outcome, state);
    return graph;
  }
  if (outcome.kind === 'failed') {
    failSchedulerTask(task.node, outcome.message, graph, state);
    return graph;
  }
  const continuation = applySchedulerContinuation(
    graph,
    nodeId,
    outcome.extension,
  );
  if (!continuation.graph) {
    failSchedulerTask(
      task.node,
      continuation.issues.join(' '),
      graph,
      state,
      'invalid-continuation',
    );
    return graph;
  }
  state.statuses.set(nodeId, 'pending');
  for (const node of continuation.graph.nodes)
    if (!state.statuses.has(node.id)) state.statuses.set(node.id, 'pending');
  state.metrics.continuationCount++;
  return continuation.graph;
}

/**
 * Handles complete task in the pipeline parallel compilation flow.
 */
function completeTask(
  nodeId: string,
  outcome: Extract<SchedulerTaskOutcome, { kind: 'completed' }>,
  state: SchedulerOutcomeState,
): void {
  state.statuses.set(nodeId, 'completed');
  if ('artifact' in outcome)
    state.artifacts.set(nodeId, {
      nodeId,
      value: outcome.artifact,
      cacheHit: false,
    });
}

/**
 * Handles fail scheduler task in the pipeline parallel compilation flow.
 */
function failSchedulerTask(
  node: CompilationGraphNode,
  message: string,
  graph: CompilationGraph,
  state: SchedulerOutcomeState,
  code: SchedulerError['code'] = 'task-failed',
): void {
  state.statuses.set(node.id, 'failed');
  state.errors.push({
    code,
    message,
    nodeId: node.id,
    span: node.span ?? SCHEDULER_FALLBACK_SPAN,
  });
  cancelTransitiveDependents(graph, node.id, state.statuses);
}

/**
 * Cancels transitive dependents and restores the prior state.
 */
function cancelTransitiveDependents(
  graph: CompilationGraph,
  failedNodeId: string,
  statuses: Map<string, SchedulerNodeStatus>,
): void {
  const dependents = new Map<string, string[]>();
  for (const edge of graph.edges)
    dependents.set(edge.from, [...(dependents.get(edge.from) ?? []), edge.to]);
  const pending = [...(dependents.get(failedNodeId) ?? [])];
  while (pending.length > 0) {
    const nodeId = pending.pop();
    if (!nodeId || statuses.get(nodeId) !== 'pending') continue;
    statuses.set(nodeId, 'cancelled');
    pending.push(...(dependents.get(nodeId) ?? []));
  }
}
