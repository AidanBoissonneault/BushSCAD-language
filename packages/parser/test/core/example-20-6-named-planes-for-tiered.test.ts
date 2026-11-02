/**
 * @author Aidan Boissonneault
 * @file example-20-6-named-planes-for-tiered.test.ts
 * @purpose Tests example 20 6 named planes for tiered behavior in the core in parser package.
 * @last-edited October 6, 2026
 */

import type {
  ExtrudeOp,
  FaceRef,
  ObjDecl,
  PlaneDecl,
  SketchDecl,
} from '@bushscad/ir';
import { describe, expect, it } from 'vitest';
import { component } from '../fixtures/component-selectors.js';
import { faceChain } from '../fixtures/face-ref-format.js';
import { parseOk } from '../fixtures/parse.js';

describe('spec example 20.6 — named planes for tiered geometry', () => {
  const SRC = `
base_unit = mm;

part tiered {
    sketch base = rect(80, 60);
    obj base = extrude(base, 5);

    plane lvl1 = offset(5 , @base.top);
    plane lvl2 = offset(10 , @lvl1);

    sketch mid = rect(60, 40);
    obj mid = extrude(mid, 5 , @lvl1);

    sketch top = rect(40, 20);
    obj top = extrude(top, 5 , @lvl2);

    sketch l1 = word('L1', size: 5, font: 'sans', align: center);
    obj l1 = cut(l1, 0.5 , @base.top.center);

    sketch l2 = word('L2', size: 5, font: 'sans', align: center);
    obj l2 = cut(l2, 0.5 , @mid.top.center);

    fillet(@base.top.edges, 1);
    fillet(@mid.top.edges, 1);
    fillet(@top.top.edges, 1);
}
`;
  it('parses with zero errors', () => {
    parseOk(SRC);
  });

  it('has two plane declarations', () => {
    const ast = parseOk(SRC);
    const c = component(ast, 'tiered');
    const planes = c.body.statements.filter(
      (s) => s.kind === 'plane',
    ) as PlaneDecl[];
    expect(planes).toHaveLength(2);
  });

  it('lvl1 , @is a faceRef (base.top)', () => {
    const ast = parseOk(SRC);
    const c = component(ast, 'tiered');
    const planes = c.body.statements.filter(
      (s) => s.kind === 'plane',
    ) as PlaneDecl[];
    expect(typeof planes[0].from).toBe('object');
    expect(faceChain(planes[0].from as FaceRef)).toBe('base.top');
  });

  it('lvl2 @ placement is a faceRef (lvl1)', () => {
    const ast = parseOk(SRC);
    const c = component(ast, 'tiered');
    const planes = c.body.statements.filter(
      (s) => s.kind === 'plane',
    ) as PlaneDecl[];
    expect(typeof planes[1].from).toBe('object');
    expect(faceChain(planes[1].from as FaceRef)).toBe('lvl1');
  });

  it('mid extrude , @plane name as faceRef', () => {
    const ast = parseOk(SRC);
    const c = component(ast, 'tiered');
    const objs = c.body.statements.filter((s) => s.kind === 'obj') as ObjDecl[];
    const midObj = objs.find((o) => o.name === 'mid')!;
    const op = midObj.operation as ExtrudeOp;
    // lvl1 has no DOT, parsed as faceRef with single name segment
    expect(op.from!.kind).toBe('faceRef');
    expect(faceChain(op.from as FaceRef)).toBe('lvl1');
  });

  it('has 3 fillets', () => {
    const ast = parseOk(SRC);
    const c = component(ast, 'tiered');
    const fillets = c.body.statements.filter((s) => s.kind === 'fillet');
    expect(fillets).toHaveLength(3);
  });

  it('word primitives parse correctly', () => {
    const ast = parseOk(SRC);
    const c = component(ast, 'tiered');
    const sketches = c.body.statements.filter(
      (s) => s.kind === 'sketch',
    ) as SketchDecl[];
    const wordSketches = sketches.filter((s) => s.primitive.kind === 'word');
    expect(wordSketches).toHaveLength(2);
  });
});
