/**
 * @author Aidan Boissonneault
 * @file graph-assembly.ts
 * @purpose Provides graph assembly behavior for the pipeline parallel compilation in compiler package.
 * @last-edited October 6, 2026
 */

import type {
  CompilationGraph,
  CompilationGraphEdge,
  CompilationGraphEdgeKind,
  CompilationGraphNode,
  CompilationPartDependency,
} from '@bushscad/ir';
import { stableDigest } from './stable-serialization.js';

/**
 * Derives `NodeDraft` from `Omit< CompilationGraphNode, 'id' | 'dependencies' | 'reads' | 'writes' |
 * 'semanticConsumerIds' | 'state' > & { key: string; reads?: readonly string[]; writes?: readonly
 * string[]; semanticConsumerIds?: readonly string[]; }` to preserve its type relationship in the
 * pipeline parallel compilation layer.
 */
export type NodeDraft = Omit<
  CompilationGraphNode,
  'id' | 'dependencies' | 'reads' | 'writes' | 'semanticConsumerIds' | 'state'
> & {
  key: string;
  reads?: readonly string[];
  writes?: readonly string[];
  semanticConsumerIds?: readonly string[];
};

/**
 * Derives `MutableNode` from `Omit< CompilationGraphNode, 'dependencies' | 'reads' | 'writes' |
 * 'semanticConsumerIds' > & { dependencies: string[]; reads: string[]; writes: string[];
 * semanticConsumerIds: string[]; }` to preserve its type relationship in the pipeline parallel
 * compilation layer.
 */
type MutableNode = Omit<
  CompilationGraphNode,
  'dependencies' | 'reads' | 'writes' | 'semanticConsumerIds'
> & {
  dependencies: string[];
  reads: string[];
  writes: string[];
  semanticConsumerIds: string[];
};

/** Accumulates graph nodes and edges before returning a deeply frozen snapshot. */
export class GraphAssembly {
  private readonly nodes = new Map<string, MutableNode>();
  private readonly edges = new Map<string, CompilationGraphEdge>();

  /**
   * Adds node to its owning collection.
   */
  addNode(draft: NodeDraft): string {
    const id = graphId(draft.kind, draft.key);
    if (this.nodes.has(id)) return id;
    const { key: _key, ...node } = draft;
    this.nodes.set(id, {
      ...node,
      id,
      dependencies: [],
      reads: [...(draft.reads ?? [])],
      writes: [...(draft.writes ?? [])],
      semanticConsumerIds: [...(draft.semanticConsumerIds ?? [])],
      state: 'planned',
    });
    return id;
  }

  /**
   * Adds consumer to its owning collection.
   */
  addConsumer(nodeId: string, consumerId: string): void {
    const node = this.requireNode(nodeId);
    if (!node.semanticConsumerIds.includes(consumerId))
      node.semanticConsumerIds.push(consumerId);
  }

  /**
   * Adds edge to its owning collection.
   */
  addEdge(
    from: string,
    to: string,
    kind: CompilationGraphEdgeKind,
    resource?: string,
  ): void {
    const id = graphId('edge', `${from}|${to}|${kind}|${resource ?? ''}`);
    if (this.edges.has(id)) return;
    this.edges.set(id, {
      id,
      from,
      to,
      kind,
      ...(resource ? { resource } : {}),
    });
    const target = this.nodes.get(to);
    if (target && !target.dependencies.includes(from))
      target.dependencies.push(from);
    if (resource) {
      const source = this.nodes.get(from);
      if (source && !source.writes.includes(resource))
        source.writes.push(resource);
      if (target && !target.reads.includes(resource))
        target.reads.push(resource);
    }
  }

  /**
   * Checks whether the input has node.
   */
  hasNode(nodeId: string): boolean {
    return this.nodes.has(nodeId);
  }

  /**
   * Handles freeze in the pipeline parallel compilation flow.
   */
  freeze(
    entrypoint: string,
    partDependencies: readonly CompilationPartDependency[],
    outputNodeId: string,
  ): CompilationGraph {
    const nodes = [...this.nodes.values()]
      .sort(
        (left, right) =>
          left.sourceOrder - right.sourceOrder ||
          left.id.localeCompare(right.id),
      )
      .map((node) => freezeNode(node));
    const edges = [...this.edges.values()]
      .sort((left, right) => edgeKey(left).localeCompare(edgeKey(right)))
      .map((edge) => Object.freeze({ ...edge }));
    return Object.freeze({
      version: 1 as const,
      entrypoint,
      nodes: Object.freeze(nodes),
      edges: Object.freeze(edges),
      partDependencies: Object.freeze(
        partDependencies.map((dependency) =>
          Object.freeze({
            partName: dependency.partName,
            dependsOn: Object.freeze([...dependency.dependsOn].sort()),
          }),
        ),
      ),
      outputNodeId,
    });
  }

  /**
   * Handles require node in the pipeline parallel compilation flow.
   */
  private requireNode(nodeId: string): MutableNode {
    const node = this.nodes.get(nodeId);
    if (!node) throw new Error(`Unknown compilation graph node '${nodeId}'.`);
    return node;
  }
}

/**
 * Handles graph ID in the pipeline parallel compilation flow.
 */
export function graphId(kind: string, key: string): string {
  return `${kind}:${stableDigest(`${kind}|${key}`)}`;
}

/**
 * Handles freeze node in the pipeline parallel compilation flow.
 */
function freezeNode(node: MutableNode): CompilationGraphNode {
  return Object.freeze({
    ...node,
    ...(node.span ? { span: Object.freeze({ ...node.span }) } : {}),
    dependencies: Object.freeze([...new Set(node.dependencies)].sort()),
    reads: Object.freeze([...new Set(node.reads)].sort()),
    writes: Object.freeze([...new Set(node.writes)].sort()),
    semanticConsumerIds: Object.freeze(
      [...new Set(node.semanticConsumerIds)].sort(),
    ),
  });
}

/**
 * Resolves the edge data required by the current selector.
 */
function edgeKey(edge: CompilationGraphEdge): string {
  return `${edge.from}|${edge.to}|${edge.kind}|${edge.resource ?? ''}`;
}
