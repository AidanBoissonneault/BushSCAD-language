/**
 * @author Aidan Boissonneault
 * @file validate-compilation-graph.ts
 * @purpose Validates compilation graph for the pipeline parallel compilation in compiler package.
 * @last-edited October 6, 2026
 */

import type {
  CompilationGraph,
  CompilationGraphDiagnostic,
  CompilationGraphDiagnosticCode,
  CompilationGraphNode,
  SourceSpan,
} from '@bushscad/ir';

const FALLBACK_SPAN: SourceSpan = {
  file: '(compilation-graph)',
  line: 1,
  col: 1,
};

/** Validates graph identity, resources, version chains, ordering, and acyclicity. */
export function validateCompilationGraph(
  graph: CompilationGraph,
): CompilationGraphDiagnostic[] {
  const diagnostics: CompilationGraphDiagnostic[] = [];
  const nodes = new Map<string, CompilationGraphNode>();
  const edgeIds = new Set<string>();
  for (const node of graph.nodes) {
    if (nodes.has(node.id))
      diagnostics.push(
        issue(
          'duplicate-node',
          `Duplicate node '${node.id}'.`,
          [node.id],
          node,
        ),
      );
    else nodes.set(node.id, node);
  }
  if (!nodes.has(graph.outputNodeId))
    diagnostics.push(
      issue(
        'missing-node',
        `Output references missing node '${graph.outputNodeId}'.`,
        [graph.outputNodeId],
      ),
    );
  for (const edge of graph.edges) {
    if (edgeIds.has(edge.id))
      diagnostics.push(
        issue(
          'duplicate-edge',
          `Duplicate edge '${edge.id}'.`,
          [edge.from, edge.to],
          nodes.get(edge.to),
        ),
      );
    edgeIds.add(edge.id);
    if (!nodes.has(edge.from) || !nodes.has(edge.to))
      diagnostics.push(
        issue(
          'missing-node',
          `Edge '${edge.id}' references a missing node.`,
          [edge.from, edge.to],
          nodes.get(edge.to),
        ),
      );
  }
  diagnostics.push(...resourceDiagnostics(graph, nodes));
  diagnostics.push(...partVersionDiagnostics(graph));
  diagnostics.push(...orderingDiagnostics(graph));
  diagnostics.push(...cycleDiagnostics(graph, nodes));
  return diagnostics.sort(diagnosticOrder);
}

/**
 * Handles resource diagnostics in the pipeline parallel compilation flow.
 */
function resourceDiagnostics(
  graph: CompilationGraph,
  nodes: ReadonlyMap<string, CompilationGraphNode>,
): CompilationGraphDiagnostic[] {
  const diagnostics: CompilationGraphDiagnostic[] = [];
  const producers = new Map<string, string[]>();
  for (const node of graph.nodes) {
    for (const resource of node.writes) {
      const ids = producers.get(resource) ?? [];
      ids.push(node.id);
      producers.set(resource, ids);
    }
  }
  for (const [resource, ids] of producers) {
    if (ids.length > 1)
      diagnostics.push({
        ...issue(
          'multiple-producers',
          `Resource '${resource}' has multiple producers.`,
          ids,
          nodes.get(ids[1] ?? ''),
        ),
        resource,
      });
  }
  const edgeKeys = new Set(
    graph.edges.map((edge) => `${edge.from}|${edge.to}|${edge.resource ?? ''}`),
  );
  for (const node of graph.nodes) {
    for (const resource of node.reads) {
      const ids = producers.get(resource) ?? [];
      if (ids.length === 0) {
        diagnostics.push({
          ...issue(
            'missing-producer',
            `Resource '${resource}' has no producer.`,
            [node.id],
            node,
          ),
          resource,
        });
      } else if (
        !ids.some((id) => edgeKeys.has(`${id}|${node.id}|${resource}`))
      ) {
        diagnostics.push({
          ...issue(
            'resource-conflict',
            `Read of '${resource}' lacks a producer dependency.`,
            [node.id, ...ids],
            node,
          ),
          resource,
        });
      }
    }
  }
  return diagnostics;
}

/**
 * Handles part version diagnostics in the pipeline parallel compilation flow.
 */
function partVersionDiagnostics(
  graph: CompilationGraph,
): CompilationGraphDiagnostic[] {
  const diagnostics: CompilationGraphDiagnostic[] = [];
  for (const node of graph.nodes.filter(
    (candidate) => candidate.kind === 'part-version',
  )) {
    const write = node.writes.find((resource) =>
      /^part:.+@\d+$/.test(resource),
    );
    const match = write?.match(/^part:(.+)@(\d+)$/);
    const version = Number(match?.[2]);
    const prior = match ? `part:${match[1]}@${version - 1}` : undefined;
    if (!match || version < 1 || !prior || !node.reads.includes(prior))
      diagnostics.push(
        issue(
          'invalid-part-version',
          `Node '${node.id}' does not read its preceding part version.`,
          [node.id],
          node,
        ),
      );
  }
  return diagnostics;
}

/**
 * Handles ordering diagnostics in the pipeline parallel compilation flow.
 */
function orderingDiagnostics(
  graph: CompilationGraph,
): CompilationGraphDiagnostic[] {
  const sorted = [...graph.nodes].sort(
    (left, right) =>
      left.sourceOrder - right.sourceOrder || left.id.localeCompare(right.id),
  );
  const mismatch = sorted.findIndex(
    (node, index) => node.id !== graph.nodes[index]?.id,
  );
  if (mismatch < 0) return [];
  const node = graph.nodes[mismatch];
  return [
    issue(
      'nondeterministic-order',
      'Graph nodes are not in stable source/ID order.',
      node ? [node.id] : [],
      node,
    ),
  ];
}

/**
 * Handles cycle diagnostics in the pipeline parallel compilation flow.
 */
function cycleDiagnostics(
  graph: CompilationGraph,
  nodes: ReadonlyMap<string, CompilationGraphNode>,
): CompilationGraphDiagnostic[] {
  const remaining = new Map(graph.nodes.map((node) => [node.id, 0]));
  const dependents = new Map<string, string[]>();
  for (const edge of graph.edges) {
    if (!remaining.has(edge.from) || !remaining.has(edge.to)) continue;
    remaining.set(edge.to, (remaining.get(edge.to) ?? 0) + 1);
    dependents.set(edge.from, [...(dependents.get(edge.from) ?? []), edge.to]);
  }
  const ready = [...remaining]
    .filter(([, count]) => count === 0)
    .map(([id]) => id)
    .sort();
  let visited = 0;
  while (ready.length > 0) {
    const id = ready.shift();
    if (!id) break;
    visited++;
    for (const dependent of (dependents.get(id) ?? []).sort()) {
      const next = (remaining.get(dependent) ?? 0) - 1;
      remaining.set(dependent, next);
      if (next === 0) ready.push(dependent);
    }
    ready.sort();
  }
  if (visited === graph.nodes.length) return [];
  const cycleIds = [...remaining]
    .filter(([, count]) => count > 0)
    .map(([id]) => id)
    .sort();
  return [
    issue(
      'cycle',
      `Compilation graph contains a cycle involving ${cycleIds.join(', ')}.`,
      cycleIds,
      nodes.get(cycleIds[0] ?? ''),
    ),
  ];
}

/**
 * Handles issue in the pipeline parallel compilation flow.
 */
function issue(
  code: CompilationGraphDiagnosticCode,
  message: string,
  nodeIds: readonly string[],
  node?: CompilationGraphNode,
): CompilationGraphDiagnostic {
  return {
    code,
    message,
    nodeIds: [...nodeIds],
    span: node?.span ?? FALLBACK_SPAN,
  };
}

/**
 * Handles diagnostic order in the pipeline parallel compilation flow.
 */
function diagnosticOrder(
  left: CompilationGraphDiagnostic,
  right: CompilationGraphDiagnostic,
): number {
  return (
    left.span.file.localeCompare(right.span.file) ||
    left.span.line - right.span.line ||
    left.span.col - right.span.col ||
    left.code.localeCompare(right.code) ||
    left.message.localeCompare(right.message)
  );
}
