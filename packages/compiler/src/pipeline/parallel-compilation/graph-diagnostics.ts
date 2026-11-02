/**
 * @author Aidan Boissonneault
 * @file graph-diagnostics.ts
 * @purpose Provides graph diagnostics behavior for the pipeline parallel compilation in compiler package.
 * @last-edited October 6, 2026
 */

import type { CompilationGraph, CompilationGraphNode } from '@bushscad/ir';
import { stableStringify } from './stable-serialization.js';

/** Exports the canonical, byte-stable JSON representation of a graph. */
export function compilationGraphToJson(graph: CompilationGraph): string {
  return `${stableStringify(graph, 2)}\n`;
}

/** Renders a dependency-first tree while marking nodes shared by consumers. */
export function compilationGraphToTree(graph: CompilationGraph): string {
  const nodes = new Map(graph.nodes.map((node) => [node.id, node]));
  const fanOut = new Map<string, number>();
  for (const edge of graph.edges)
    fanOut.set(edge.from, (fanOut.get(edge.from) ?? 0) + 1);
  const lines: string[] = [];
  renderTreeNode(graph.outputNodeId, '', true, new Set(), nodes, fanOut, lines);
  return `${lines.join('\n')}\n`;
}

/** Renders deterministic Graphviz DOT using only redacted recipe digests. */
export function compilationGraphToDot(graph: CompilationGraph): string {
  const lines = ['digraph bushscad_compilation {', '  rankdir=LR;'];
  for (const node of graph.nodes) {
    const detail = node.recipeDigest ? `\\nrecipe:${node.recipeDigest}` : '';
    const label = escapeDot(`${node.kind}: ${node.label}${detail}`);
    lines.push(`  "${node.id}" [label="${label}"];`);
  }
  for (const edge of graph.edges) {
    const resource = edge.resource ? `:${shortResource(edge.resource)}` : '';
    lines.push(
      `  "${edge.from}" -> "${edge.to}" [label="${escapeDot(`${edge.kind}${resource}`)}"];`,
    );
  }
  lines.push('}');
  return `${lines.join('\n')}\n`;
}

/**
 * Handles render tree node in the pipeline parallel compilation flow.
 */
function renderTreeNode(
  nodeId: string,
  prefix: string,
  last: boolean,
  path: ReadonlySet<string>,
  nodes: ReadonlyMap<string, CompilationGraphNode>,
  fanOut: ReadonlyMap<string, number>,
  lines: string[],
): void {
  const node = nodes.get(nodeId);
  if (!node) {
    lines.push(`${prefix}${last ? '\\-' : '+-'} missing:${nodeId}`);
    return;
  }
  const shared = (fanOut.get(node.id) ?? 0) > 1 ? ' [shared]' : '';
  const recipe = node.recipeDigest ? ` recipe:${node.recipeDigest}` : '';
  lines.push(
    `${prefix}${last ? '\\-' : '+-'} ${node.kind}: ${node.label}${shared}${recipe}`,
  );
  if (path.has(nodeId)) {
    lines.push(`${prefix}${last ? '  ' : '| '}\\- cycle:${nodeId}`);
    return;
  }
  const nextPath = new Set(path);
  nextPath.add(nodeId);
  node.dependencies.forEach((dependency, index) =>
    renderTreeNode(
      dependency,
      `${prefix}${last ? '  ' : '| '}`,
      index === node.dependencies.length - 1,
      nextPath,
      nodes,
      fanOut,
      lines,
    ),
  );
}

/**
 * Handles short resource in the pipeline parallel compilation flow.
 */
function shortResource(resource: string): string {
  return resource.length <= 48 ? resource : `${resource.slice(0, 45)}...`;
}

/**
 * Handles escape dot in the pipeline parallel compilation flow.
 */
function escapeDot(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"');
}
