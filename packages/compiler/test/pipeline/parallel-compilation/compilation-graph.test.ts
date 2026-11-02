/**
 * @author Aidan Boissonneault
 * @file compilation-graph.test.ts
 * @purpose Tests compilation graph behavior in the pipeline parallel compilation in compiler package.
 * @last-edited October 6, 2026
 */

import type { CompilationGraph, IROp, IRProgram } from '@bushscad/ir';
import { describe, expect, it } from 'vitest';
import {
  buildCompilationGraph,
  compilationGraphToDot,
  compilationGraphToJson,
  compilationGraphToTree,
} from '../../../src/index.js';
import { compile } from '../test-support.js';

/**
 * Builds the result from the supplied inputs.
 */
function build(source: string, entrypoint = 'graph-test.bscd') {
  const compiled = compile(source);
  expect(compiled.ok).toBe(true);
  if (!compiled.ok) throw new Error(compiled.errors[0]?.message);
  const result = buildCompilationGraph(compiled.program, { entrypoint });
  expect(result.diagnostics).toEqual([]);
  return result.graph;
}

/**
 * Handles recipe digests for in the pipeline parallel compilation flow.
 */
function recipeDigestsFor(
  graph: CompilationGraph,
  operationKind: IROp['kind'],
): string[] {
  return graph.nodes
    .filter((node) => node.operationKind === operationKind)
    .map((node) => node.recipeDigest)
    .filter((digest): digest is string => digest !== undefined);
}

describe('parallel compilation graph lowering', () => {
  it('interns identical geometry recipes while retaining semantic instances', () => {
    const graph = build(`
part repeated {
  sketch circle_a = circle(20);
  sketch circle_b = circle(20);
  sketch circle_c = circle(22);
  obj block_a = cube([40, 40, 60]);
  obj block_b = cube([40, 40, 60]);
  obj block_c = cube([41, 40, 60]);
}
`);

    const circleDigests = recipeDigestsFor(graph, 'sketch');
    const cuboidDigests = recipeDigestsFor(graph, 'solidPrimitive');
    expect(new Set(circleDigests)).toHaveLength(2);
    expect(new Set(cuboidDigests)).toHaveLength(2);
    expect(circleDigests[0]).toBe(circleDigests[1]);
    expect(cuboidDigests[0]).toBe(cuboidDigests[1]);

    const sharedRecipes = graph.nodes.filter(
      (node) => node.kind === 'recipe' && node.semanticConsumerIds.length === 2,
    );
    expect(sharedRecipes).toHaveLength(2);
    expect(
      graph.nodes.filter((node) => node.operationKind === 'sketch'),
    ).toHaveLength(3);
    expect(
      graph.nodes.filter(
        (node) =>
          node.kind === 'instance' && node.operationKind === 'solidPrimitive',
      ),
    ).toHaveLength(3);
  });

  it('includes workplane and content-addressed assets in recipe identity', () => {
    const xy = build('sketch profile = circle(20);', 'xy.bscd');
    const yz = build(
      'workplane = YZ; sketch profile = circle(20);',
      'yz.bscd',
    );
    expect(recipeDigestsFor(xy, 'sketch')[0]).not.toBe(
      recipeDigestsFor(yz, 'sketch')[0],
    );

    const span = { file: 'assets.bscd', line: 1, col: 1 };
    const program: IRProgram = {
      baseUnitMm: 1,
      parts: [],
      ops: [
        {
          kind: 'importShape',
          name: 'a',
          fsPath: 'a.step',
          format: 'step',
          span,
        },
        {
          kind: 'importShape',
          name: 'b',
          fsPath: 'b.step',
          format: 'step',
          span,
        },
        {
          kind: 'importShape',
          name: 'c',
          fsPath: 'c.step',
          format: 'step',
          span,
        },
      ],
    };
    const assets = buildCompilationGraph(program, {
      entrypoint: span.file,
      assetDigests: {
        'a.step': 'same',
        'b.step': 'same',
        'c.step': 'different',
      },
    });
    expect(assets.ok).toBe(true);
    expect(new Set(recipeDigestsFor(assets.graph, 'importShape'))).toHaveLength(
      2,
    );
  });

  it('emits deterministic, immutable, and redacted diagnostics views', () => {
    const source = `
part repeated {
  sketch a = circle(20);
  sketch b = circle(20);
}
`;
    const first = build(source);
    const second = build(source);
    expect(compilationGraphToJson(first)).toBe(compilationGraphToJson(second));
    expect(compilationGraphToTree(first)).toContain('[shared]');
    expect(compilationGraphToDot(first)).toContain('recipe:');
    expect(compilationGraphToDot(first)).not.toContain('"primitive"');
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.nodes)).toBe(true);
    expect(first.nodes.every(Object.isFrozen)).toBe(true);
  });

  it('records the same explicit placement dependency used by classic execution', () => {
    const graph = build(`
part housing {
  obj body = cube([40, 40, 10]);
}
part cap {
  obj mounted = cube([20, 20, 2], @housing.top.center);
}
`);
    expect(graph.partDependencies).toEqual([
      { partName: 'housing', dependsOn: [] },
      { partName: 'cap', dependsOn: ['housing'] },
    ]);
  });

  it('marks continuations from concrete geometry needs rather than broad kinds', () => {
    const graph = build(`
part transforms {
  obj first = cuboid([10, 10, 10]);
  obj second = cuboid([10, 10, 10]);
  transform(first, translate(x: 20));
  fuse(first, second);
}
`);
    const concrete = graph.nodes.filter(
      (node) =>
        node.kind === 'operation' &&
        ['transform', 'fuse'].includes(node.operationKind ?? ''),
    );
    expect(
      concrete.map((node) => [node.operationKind, node.continuation]),
    ).toEqual([
      ['transform', false],
      ['fuse', false],
    ]);
  });
});
