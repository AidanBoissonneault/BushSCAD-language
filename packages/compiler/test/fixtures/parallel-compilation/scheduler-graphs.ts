/**
 * @author Aidan Boissonneault
 * @file scheduler-graphs.ts
 * @purpose Tests scheduler graphs behavior in the fixtures parallel compilation in compiler package.
 * @last-edited October 6, 2026
 */

import type {
  CompilationGraph,
  CompilationGraphEdge,
  CompilationGraphEdgeKind,
  CompilationGraphNode,
} from '@bushscad/ir';
import { SimulatedWorkerPool } from '../../../src/index.js';

/**
 * Handles scheduler node in the fixtures parallel compilation flow.
 */
export function schedulerNode(
  id: string,
  sourceOrder: number,
  fields: Partial<CompilationGraphNode> = {},
): CompilationGraphNode {
  return Object.freeze({
    id,
    kind: 'operation',
    label: id,
    sourceOrder,
    span: {
      file: 'scheduler-fixture.bscd',
      line: sourceOrder + 1,
      col: 1,
    },
    polarity: 'neutral',
    topologySensitive: false,
    orderSensitive: false,
    continuation: false,
    cacheSafe: false,
    estimatedCost: 'medium',
    semanticConsumerIds: Object.freeze([]),
    dependencies: Object.freeze([]),
    reads: Object.freeze([]),
    writes: Object.freeze([]),
    state: 'planned',
    ...fields,
  });
}

/**
 * Handles scheduler edge in the fixtures parallel compilation flow.
 */
export function schedulerEdge(
  from: string,
  to: string,
  kind: CompilationGraphEdgeKind = 'shape',
  resource?: string,
): CompilationGraphEdge {
  return Object.freeze({
    id: `edge:${from}:${to}:${kind}:${resource ?? ''}`,
    from,
    to,
    kind,
    ...(resource ? { resource } : {}),
  });
}

/** Builds a stable valid scheduler graph and derives dependency lists. */
export function schedulerGraph(
  nodes: readonly CompilationGraphNode[],
  edges: readonly CompilationGraphEdge[],
  outputNodeId = nodes.at(-1)?.id ?? 'output',
): CompilationGraph {
  const dependencies = new Map<string, string[]>();
  for (const edge of edges)
    dependencies.set(edge.to, [
      ...(dependencies.get(edge.to) ?? []),
      edge.from,
    ]);
  const orderedNodes = [...nodes]
    .sort(
      (left, right) =>
        left.sourceOrder - right.sourceOrder || left.id.localeCompare(right.id),
    )
    .map((node) =>
      Object.freeze({
        ...node,
        dependencies: Object.freeze(
          [...new Set(dependencies.get(node.id) ?? [])].sort(),
        ),
      }),
    );
  return Object.freeze({
    version: 1,
    entrypoint: 'scheduler-fixture.bscd',
    nodes: Object.freeze(orderedNodes),
    edges: Object.freeze(
      [...edges].sort((left, right) => left.id.localeCompare(right.id)),
    ),
    partDependencies: Object.freeze([]),
    outputNodeId,
  });
}

/**
 * Handles ready worker pool in the fixtures parallel compilation flow.
 */
export function readyWorkerPool(count = 2): SimulatedWorkerPool {
  const pool = new SimulatedWorkerPool({
    maximumWorkerCount: 4,
    memoryPerWorkerMiB: 1024,
    memoryBudgetMiB: 4096,
  });
  const capacity = pool.reconcile(count);
  if (!capacity.ok) throw new Error(capacity.issues.join(' '));
  for (const worker of pool.snapshot()) {
    if (worker.state === 'warming') pool.markReady(worker.id);
  }
  return pool;
}
