/**
 * @author Aidan Boissonneault
 * @file compilation-graph-validation.test.ts
 * @purpose Tests compilation graph validation behavior in the pipeline parallel compilation in compiler package.
 * @last-edited October 6, 2026
 */

import type {
  CompilationGraph,
  CompilationGraphEdge,
  CompilationGraphNode,
} from '@bushscad/ir';
import { describe, expect, it } from 'vitest';
import { validateCompilationGraph } from '../../../src/index.js';

const span = { file: 'invalid-graph.bscd', line: 7, col: 11 };

/**
 * Handles node in the pipeline parallel compilation flow.
 */
function node(
  id: string,
  sourceOrder: number,
  fields: Partial<CompilationGraphNode> = {},
): CompilationGraphNode {
  return {
    id,
    kind: 'operation',
    label: id,
    sourceOrder,
    span,
    polarity: 'neutral',
    topologySensitive: false,
    orderSensitive: false,
    continuation: false,
    cacheSafe: false,
    estimatedCost: 'light',
    semanticConsumerIds: [],
    dependencies: [],
    reads: [],
    writes: [],
    state: 'planned',
    ...fields,
  };
}

/**
 * Resolves the edge data required by the current selector.
 */
function edge(from: string, to: string): CompilationGraphEdge {
  return { id: `${from}-${to}`, from, to, kind: 'shape' };
}

/**
 * Handles graph in the pipeline parallel compilation flow.
 */
function graph(
  nodes: readonly CompilationGraphNode[],
  edges: readonly CompilationGraphEdge[] = [],
  outputNodeId = nodes.at(-1)?.id ?? 'missing-output',
): CompilationGraph {
  return {
    version: 1,
    entrypoint: span.file,
    nodes,
    edges,
    partDependencies: [],
    outputNodeId,
  };
}

describe('parallel compilation graph validation', () => {
  it('reports missing and conflicting resource producers at the consumer span', () => {
    const diagnostics = validateCompilationGraph(
      graph([
        node('first', 0, { writes: ['shared'] }),
        node('second', 1, { writes: ['shared'] }),
        node('reader', 2, { reads: ['shared', 'absent'] }),
      ]),
    );

    expect(diagnostics.map(({ code }) => code)).toEqual([
      'missing-producer',
      'multiple-producers',
      'resource-conflict',
    ]);
    expect(diagnostics.every((diagnostic) => diagnostic.span === span)).toBe(
      true,
    );
  });

  it('reports cycles and invalid part-version chains', () => {
    const diagnostics = validateCompilationGraph(
      graph(
        [
          node('a', 0),
          node('b', 1),
          node('part-v2', 2, {
            kind: 'part-version',
            writes: ['part:case@2'],
          }),
        ],
        [edge('a', 'b'), edge('b', 'a')],
        'part-v2',
      ),
    );

    expect(diagnostics.map(({ code }) => code)).toEqual([
      'cycle',
      'invalid-part-version',
    ]);
  });

  it('reports missing edge endpoints and missing output nodes', () => {
    const diagnostics = validateCompilationGraph(
      graph(
        [node('only', 0)],
        [edge('missing-source', 'only')],
        'missing-output',
      ),
    );

    expect(diagnostics.map(({ code }) => code)).toEqual([
      'missing-node',
      'missing-node',
    ]);
  });
});
