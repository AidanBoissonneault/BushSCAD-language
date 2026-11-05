/**
 * @author Aidan Boissonneault
 * @file compilation-graph.ts
 * @purpose Provides compilation graph behavior for the pipeline in IR package.
 * @last-edited October 6, 2026
 */

import type { IROp, SourceSpan } from '../shared/ir.js';

/**
 * Accepted values for compilation graph node kind are 'source', 'part', 'recipe', 'definition',
 * 'instance', 'operation', 'part-version', 'relationship', and 'output'.
 */
export type CompilationGraphNodeKind =
  | 'source'
  | 'part'
  | 'recipe'
  | 'definition'
  | 'instance'
  | 'operation'
  | 'part-version'
  | 'relationship'
  | 'output';

/**
 * Accepted values for compilation graph edge kind are 'shape', 'topology', 'effect-order',
 * 'scope', 'asset', 'output', and 'barrier'.
 */
export type CompilationGraphEdgeKind =
  | 'shape'
  | 'topology'
  | 'effect-order'
  | 'scope'
  | 'asset'
  | 'output'
  | 'barrier';

/**
 * Accepted values for compilation polarity are 'positive', 'negative', and 'neutral'.
 */
export type CompilationPolarity = 'positive' | 'negative' | 'neutral';
/**
 * Accepted values for compilation cost class are 'metadata', 'light', 'medium', and 'heavy'.
 */
export type CompilationCostClass = 'metadata' | 'light' | 'medium' | 'heavy';

/**
 * Type used for node in compilation graph.
 */
export type CompilationGraphNode = Readonly<{
  id: string;
  kind: CompilationGraphNodeKind;
  label: string;
  sourceOrder: number;
  span?: SourceSpan;
  partName?: string;
  operationKind?: IROp['kind'];
  polarity: CompilationPolarity;
  topologySensitive: boolean;
  orderSensitive: boolean;
  continuation: boolean;
  cacheSafe: boolean;
  estimatedCost: CompilationCostClass;
  recipeDigest?: string;
  /** Canonical recipe used to verify a compact digest before persistent reuse. */
  recipeCanonical?: string;
  semanticConsumerIds: readonly string[];
  dependencies: readonly string[];
  reads: readonly string[];
  writes: readonly string[];
  state: 'planned';
}>;

/**
 * Type used for compilation graph edge.
 */
export type CompilationGraphEdge = Readonly<{
  id: string;
  from: string;
  to: string;
  kind: CompilationGraphEdgeKind;
  resource?: string;
}>;

/**
 * Type used for compilation part dependency.
 */
export type CompilationPartDependency = Readonly<{
  partName: string;
  dependsOn: readonly string[];
}>;

/**
 * Type used for compilation graph.
 */
export type CompilationGraph = Readonly<{
  version: 1;
  entrypoint: string;
  nodes: readonly CompilationGraphNode[];
  edges: readonly CompilationGraphEdge[];
  partDependencies: readonly CompilationPartDependency[];
  outputNodeId: string;
}>;

/**
 * Accepted values for compilation graph diagnostic code are 'duplicate-node', 'duplicate-edge',
 * 'missing-node', 'missing-producer', 'multiple-producers', 'resource-conflict', 'cycle',
 * 'invalid-part-version', and 'nondeterministic-order'.
 */
export type CompilationGraphDiagnosticCode =
  | 'duplicate-node'
  | 'duplicate-edge'
  | 'missing-node'
  | 'missing-producer'
  | 'multiple-producers'
  | 'resource-conflict'
  | 'cycle'
  | 'invalid-part-version'
  | 'nondeterministic-order';

/**
 * Type used for compilation graph diagnostic.
 */
export type CompilationGraphDiagnostic = Readonly<{
  code: CompilationGraphDiagnosticCode;
  message: string;
  nodeIds: readonly string[];
  resource?: string;
  span: SourceSpan;
}>;

/**
 * Type used for result of compilation graph build.
 */
export type CompilationGraphBuildResult = Readonly<{
  graph: CompilationGraph;
  diagnostics: readonly CompilationGraphDiagnostic[];
  ok: boolean;
}>;
