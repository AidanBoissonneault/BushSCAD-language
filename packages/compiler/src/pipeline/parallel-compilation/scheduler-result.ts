/**
 * @author Aidan Boissonneault
 * @file scheduler-result.ts
 * @purpose Provides scheduler result behavior for the pipeline parallel compilation in compiler package.
 * @last-edited October 6, 2026
 */

import type { CompilationGraph, CompilationGraphNode } from '@bushscad/ir';
import type {
  SchedulerArtifact,
  SchedulerError,
  SchedulerMetrics,
  SchedulerNodeStatus,
  SchedulerSimulationResult,
  SchedulerWorkerPool,
} from './scheduler-types.js';

/**
 * Measurements for mutable scheduler, including dispatched task count, cache hit count,
 * continuation count, maximum geometry concurrency, and maximum metadata concurrency.
 */
export type MutableSchedulerMetrics = {
  dispatchedTaskCount: number;
  cacheHitCount: number;
  continuationCount: number;
  maximumGeometryConcurrency: number;
  maximumMetadataConcurrency: number;
  effectiveWorkerCount: number;
};

/** Assembles scheduler output in graph order rather than completion order. */
export function schedulerResult(
  graph: CompilationGraph,
  statuses: ReadonlyMap<string, SchedulerNodeStatus>,
  attempts: ReadonlyMap<string, number>,
  artifacts: ReadonlyMap<string, SchedulerArtifact>,
  errors: readonly SchedulerError[],
  metrics: MutableSchedulerMetrics,
  workerPool: SchedulerWorkerPool,
  cancelled: boolean,
): SchedulerSimulationResult {
  const nodeOrder = new Map(
    graph.nodes.map((node, index) => [node.id, { node, index }]),
  );
  const orderedErrors = [...errors].sort((left, right) =>
    errorOrder(left, right, nodeOrder),
  );
  const orderedArtifacts = [...artifacts.values()].sort(
    (left, right) =>
      (nodeOrder.get(left.nodeId)?.index ?? Number.MAX_SAFE_INTEGER) -
        (nodeOrder.get(right.nodeId)?.index ?? Number.MAX_SAFE_INTEGER) ||
      left.nodeId.localeCompare(right.nodeId),
  );
  const nodes = graph.nodes.map((node) =>
    Object.freeze({
      nodeId: node.id,
      status: statuses.get(node.id) ?? 'cancelled',
      attempts: attempts.get(node.id) ?? 0,
    }),
  );
  const counts = countStatuses(nodes.map(({ status }) => status));
  const finalMetrics: SchedulerMetrics = Object.freeze({
    totalNodeCount: graph.nodes.length,
    ...metrics,
    completedNodeCount: counts.completed,
    failedNodeCount: counts.failed,
    cancelledNodeCount: counts.cancelled,
  });
  return Object.freeze({
    ok:
      !cancelled &&
      orderedErrors.length === 0 &&
      counts.completed === graph.nodes.length,
    cancelled,
    graph,
    nodes: Object.freeze(nodes),
    artifacts: Object.freeze(orderedArtifacts),
    errors: Object.freeze(orderedErrors),
    metrics: finalMetrics,
    workerSnapshot: workerPool.snapshot(),
  });
}

/**
 * Handles count statuses in the pipeline parallel compilation flow.
 */
function countStatuses(statuses: readonly SchedulerNodeStatus[]): {
  completed: number;
  failed: number;
  cancelled: number;
} {
  return {
    completed: statuses.filter((status) => status === 'completed').length,
    failed: statuses.filter((status) => status === 'failed').length,
    cancelled: statuses.filter((status) => status === 'cancelled').length,
  };
}

/**
 * Handles error order in the pipeline parallel compilation flow.
 */
function errorOrder(
  left: SchedulerError,
  right: SchedulerError,
  nodeOrder: ReadonlyMap<
    string,
    Readonly<{ node: CompilationGraphNode; index: number }>
  >,
): number {
  return firstDifference(
    left.span.file.localeCompare(right.span.file),
    left.span.line - right.span.line,
    left.span.col - right.span.col,
    (nodeOrder.get(left.nodeId ?? '')?.index ?? Number.MAX_SAFE_INTEGER) -
      (nodeOrder.get(right.nodeId ?? '')?.index ?? Number.MAX_SAFE_INTEGER),
    left.code.localeCompare(right.code),
    left.message.localeCompare(right.message),
  );
}

/**
 * Returns the first difference that matches the requested condition.
 */
function firstDifference(...differences: readonly number[]): number {
  return differences.find((difference) => difference !== 0) ?? 0;
}
