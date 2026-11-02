/**
 * @author Aidan Boissonneault
 * @file scheduler-continuations.ts
 * @purpose Provides scheduler continuations behavior for the pipeline parallel compilation in compiler package.
 * @last-edited October 6, 2026
 */

import type {
  CompilationGraph,
  CompilationGraphEdge,
  CompilationGraphNode,
} from '@bushscad/ir';
import { validateCompilationGraph } from './validate-compilation-graph.js';
import type { SchedulerGraphExtension } from './scheduler-types.js';

/**
 * Type used for continuation application.
 */
export type ContinuationApplication = Readonly<{
  graph?: CompilationGraph;
  issues: readonly string[];
}>;

/** Adds a continuation subgraph and requires it to feed the suspended node. */
export function applySchedulerContinuation(
  graph: CompilationGraph,
  resumeNodeId: string,
  extension: SchedulerGraphExtension,
): ContinuationApplication {
  const resumeNode = graph.nodes.find((node) => node.id === resumeNodeId);
  const existingNodeIds = new Set(graph.nodes.map((node) => node.id));
  const newNodeIds = new Set(extension.nodes.map((node) => node.id));
  const issues = continuationIssues(
    resumeNode?.continuation === true,
    resumeNodeId,
    extension,
    existingNodeIds,
    newNodeIds,
  );
  if (issues.length > 0) return Object.freeze({ issues });

  const merged = freezeMergedGraph(graph, extension);
  const diagnostics = validateCompilationGraph(merged);
  if (diagnostics.length > 0)
    return Object.freeze({
      issues: diagnostics.map(
        (diagnostic) => `${diagnostic.code}: ${diagnostic.message}`,
      ),
    });
  return Object.freeze({ graph: merged, issues: Object.freeze([]) });
}

/**
 * Handles continuation issues in the pipeline parallel compilation flow.
 */
function continuationIssues(
  continuationBoundary: boolean,
  resumeNodeId: string,
  extension: SchedulerGraphExtension,
  existingNodeIds: ReadonlySet<string>,
  newNodeIds: ReadonlySet<string>,
): string[] {
  const issues: string[] = [];
  if (!continuationBoundary)
    issues.push(`Node '${resumeNodeId}' is not a continuation boundary.`);
  if (extension.nodes.length === 0)
    issues.push('A continuation must add at least one node.');
  if (newNodeIds.size !== extension.nodes.length)
    issues.push('Continuation node IDs must be unique.');
  for (const nodeId of newNodeIds)
    if (existingNodeIds.has(nodeId))
      issues.push(`Continuation node '${nodeId}' already exists.`);
  issues.push(
    ...continuationEdgeIssues(extension, existingNodeIds, newNodeIds),
  );
  if (!hasResumeDependency(extension, resumeNodeId, newNodeIds))
    issues.push(
      `Continuation does not add a dependency for '${resumeNodeId}'.`,
    );
  return issues;
}

/**
 * Handles continuation edge issues in the pipeline parallel compilation flow.
 */
function continuationEdgeIssues(
  extension: SchedulerGraphExtension,
  existingNodeIds: ReadonlySet<string>,
  newNodeIds: ReadonlySet<string>,
): string[] {
  const allNodeIds = new Set([...existingNodeIds, ...newNodeIds]);
  return extension.edges.flatMap((edge) => {
    const issues: string[] = [];
    if (!allNodeIds.has(edge.from) || !allNodeIds.has(edge.to))
      issues.push(`Continuation edge '${edge.id}' has a missing endpoint.`);
    if (!newNodeIds.has(edge.from) && !newNodeIds.has(edge.to))
      issues.push(`Continuation edge '${edge.id}' does not touch a new node.`);
    return issues;
  });
}

/**
 * Checks whether the input has resume dependency.
 */
function hasResumeDependency(
  extension: SchedulerGraphExtension,
  resumeNodeId: string,
  newNodeIds: ReadonlySet<string>,
): boolean {
  return extension.edges.some(
    (edge) => newNodeIds.has(edge.from) && edge.to === resumeNodeId,
  );
}

/**
 * Handles freeze merged graph in the pipeline parallel compilation flow.
 */
function freezeMergedGraph(
  graph: CompilationGraph,
  extension: SchedulerGraphExtension,
): CompilationGraph {
  const edges = [...graph.edges, ...extension.edges]
    .sort((left, right) => edgeKey(left).localeCompare(edgeKey(right)))
    .map((edge) => Object.freeze({ ...edge }));
  const reads = new Map<string, Set<string>>();
  const writes = new Map<string, Set<string>>();
  const dependencies = new Map<string, Set<string>>();
  for (const node of [...graph.nodes, ...extension.nodes]) {
    reads.set(node.id, new Set(node.reads));
    writes.set(node.id, new Set(node.writes));
    dependencies.set(node.id, new Set());
  }
  for (const edge of edges) {
    dependencies.get(edge.to)?.add(edge.from);
    if (edge.resource) {
      reads.get(edge.to)?.add(edge.resource);
      writes.get(edge.from)?.add(edge.resource);
    }
  }
  const nodes = [...graph.nodes, ...extension.nodes]
    .sort(
      (left, right) =>
        left.sourceOrder - right.sourceOrder || left.id.localeCompare(right.id),
    )
    .map((node) =>
      freezeNode(
        node,
        dependencies.get(node.id),
        reads.get(node.id),
        writes.get(node.id),
      ),
    );
  return Object.freeze({
    ...graph,
    nodes: Object.freeze(nodes),
    edges: Object.freeze(edges),
  });
}

/**
 * Handles freeze node in the pipeline parallel compilation flow.
 */
function freezeNode(
  node: CompilationGraphNode,
  dependencies = new Set<string>(),
  reads = new Set<string>(),
  writes = new Set<string>(),
): CompilationGraphNode {
  return Object.freeze({
    ...node,
    ...(node.span ? { span: Object.freeze({ ...node.span }) } : {}),
    dependencies: Object.freeze([...dependencies].sort()),
    reads: Object.freeze([...reads].sort()),
    writes: Object.freeze([...writes].sort()),
    semanticConsumerIds: Object.freeze([...node.semanticConsumerIds]),
  });
}

/**
 * Resolves the edge data required by the current selector.
 */
function edgeKey(edge: CompilationGraphEdge): string {
  return `${edge.from}|${edge.to}|${edge.kind}|${edge.resource ?? ''}|${edge.id}`;
}
