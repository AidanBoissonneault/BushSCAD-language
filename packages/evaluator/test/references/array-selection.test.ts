/**
 * @author Aidan Boissonneault
 * @file array-selection.test.ts
 * @purpose Tests array selection behavior in the references in evaluator package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import type {
  IRChamfer,
  IRCut,
  IRFillet,
  IRLoft,
  IRShell,
  IRSketch,
} from '@bushscad/ir';
import { evalErrorMessages, evalOps, opsOfKind } from '../core/test-support.js';

/**
 * Returns generated cut objects for a named repeated declaration.
 *
 * Why:
 * Selector tests assert deterministic naming and face expansion for repeated
 * cuts in several places, while the IR lookup rules should stay identical.
 */
function cutsForDeclaration(
  ops: ReturnType<typeof evalOps>,
  name: string,
): IRCut[] {
  return opsOfKind<IRCut>(ops, 'cut').filter((op) =>
    op.objName.startsWith(name),
  );
}

/**
 * Asserts the deterministic naming scheme for repeated cut objects.
 *
 * Why:
 * The first generated object keeps the declared name and later objects receive
 * stable suffixes, which multiple selector cases must verify consistently.
 */
function expectRepeatedCutNames(cuts: IRCut[], name: string): void {
  expect(cuts.map((op) => op.objName)[0]).toBe(name);
  expect(cuts.map((op) => op.objName)[1]).toMatch(new RegExp(`^${name}_\\d+$`));
}

/**
 * Asserts face references emitted by repeated cut placements.
 *
 * Why:
 * Repeated selector cases differ by selector syntax, but they all need to
 * prove that the expanded cut placements preserve reference order.
 */
function expectCutFaceRefs(cuts: IRCut[], expected: string[]): void {
  expect(cuts.map((op) => op.from.faceRef)).toEqual(expected);
}

describe('array selector evaluation', () => {
  it('emits repeated fillets and chamfers in Cartesian order', () => {
    const ops = evalOps(`
part p {
  sketch s = rect(10, 10);
  obj body = extrude(s, 1);
  obj body2 = extrude(s, 1);
  fillet(@[body, body2].[top, bottom].edges, 2);
  chamfer([@body.top.edges, @body2.bottom.edges], 1);
}
`);
    expect(opsOfKind<IRFillet>(ops, 'fillet').map((op) => op.target)).toEqual([
      'body.top.edges',
      'body.bottom.edges',
      'body2.top.edges',
      'body2.bottom.edges',
    ]);
    expect(opsOfKind<IRChamfer>(ops, 'chamfer').map((op) => op.target)).toEqual(
      ['body.top.edges', 'body2.bottom.edges'],
    );
  });

  it('repeats placement-based cuts with deterministic names', () => {
    const ops = evalOps(`
part p {
  sketch s = rect(10, 10);
  sketch h = circle(2);
  obj body = extrude(s, 1);
  obj body2 = extrude(s, 1);
  obj pocket = cut(h, 0.5, @[body, body2].top);
}
`);
    const cuts = cutsForDeclaration(ops, 'pocket');
    expectRepeatedCutNames(cuts, 'pocket');
    expectCutFaceRefs(cuts, ['body.top', 'body2.top']);
  });

  it('repeats operations from selector-name variables', () => {
    const ops = evalOps(`
part p {
  var sides = [top, bottom];
  obj body = extrude(rect(10, 10), 1);
  obj pocket = cut(circle(1), 0.5, @body.sides);
  fillet(@body.sides.edges, 1);
}
`);
    const cuts = cutsForDeclaration(ops, 'pocket');
    expectRepeatedCutNames(cuts, 'pocket');
    expectCutFaceRefs(cuts, ['body.top', 'body.bottom']);
    expect(opsOfKind<IRFillet>(ops, 'fillet').map((op) => op.target)).toEqual([
      'body.top.edges',
      'body.bottom.edges',
    ]);
  });

  it('repeats operations from explicit reference variables', () => {
    const ops = evalOps(`
part p {
  obj body = extrude(rect(10, 10), 1);
  var targets = [@body.top, @body.bottom];
  fillet(@targets.edges, 1);
}
`);
    expect(opsOfKind<IRFillet>(ops, 'fillet').map((op) => op.target)).toEqual([
      'body.top.edges',
      'body.bottom.edges',
    ]);
  });

  it('expands wildcard selectors over valid face continuations', () => {
    const ops = evalOps(`
part p {
  obj body = extrude(rect(10, 10), 1);
  fillet(@body.*.edges, 1);
}
`);
    expect(opsOfKind<IRFillet>(ops, 'fillet').map((op) => op.target)).toEqual([
      'body.top.edges',
      'body.bottom.edges',
      'body.front.edges',
      'body.back.edges',
      'body.left.edges',
      'body.right.edges',
    ]);
  });

  it('filters wildcard candidates by the remaining suffix', () => {
    const ops = evalOps(`
part p {
  obj body = extrude(rect(10, 10), 1);
  obj child = cut(circle(1), 0.5, @body.top);
  fillet(@*.top.edges, 1);
}
`);
    expect(opsOfKind<IRFillet>(ops, 'fillet').map((op) => op.target)).toEqual([
      'body.top.edges',
      'child.top.edges',
    ]);
  });

  it('composes wildcard selectors with generated object array indexes', () => {
    const ops = evalOps(`
part p {
  sketch h = rect(1, 1);
  obj body = extrude(rect(10, 10), 1);
  obj pocket = cut(h, 0.5, @body.[top, bottom]);
  chamfer(@pocket[1].*.edges, 0.5);
}
`);
    const pockets = opsOfKind<IRCut>(ops, 'cut').filter((op) =>
      op.objName.startsWith('pocket'),
    );
    const selectedName = pockets[1]?.objName;
    expect(opsOfKind<IRChamfer>(ops, 'chamfer').map((op) => op.target)).toEqual(
      [
        `${selectedName}.top.edges`,
        `${selectedName}.bottom.edges`,
        `${selectedName}.front.edges`,
        `${selectedName}.back.edges`,
        `${selectedName}.left.edges`,
        `${selectedName}.right.edges`,
      ],
    );
  });

  it('reports empty wildcard matches', () => {
    expect(
      evalErrorMessages(`
part p {
  obj body = extrude(rect(10, 10), 1);
  fillet(@body.*.missing.edges, 1);
}
`),
    ).toContain('Wildcard selector did not match any valid references');
  });

  it('binds expanded object declarations as ordered arrays', () => {
    const ops = evalOps(`
part p {
  sketch base = rect(10, 10);
  sketch h = circle(1);
  obj body = extrude(base, 1);
  obj pocket = cut(h, 0.5, @body.[top, bottom]);
  fillet(@pocket.edges, 1);
  chamfer(@pocket[1].edges, 0.5);
  shell(pocket, 0.2);
}
`);
    const pockets = opsOfKind<IRCut>(ops, 'cut').filter((op) =>
      op.objName.startsWith('pocket'),
    );
    expect(pockets.map((op) => op.objName)).toEqual(['pocket', 'pocket_0']);
    expect(opsOfKind<IRFillet>(ops, 'fillet').map((op) => op.target)).toEqual([
      'pocket.edges',
      'pocket_0.edges',
    ]);
    expect(opsOfKind<IRChamfer>(ops, 'chamfer').map((op) => op.target)).toEqual(
      ['pocket_0.edges'],
    );
    expect(opsOfKind<IRShell>(ops, 'shell').map((op) => op.objName)).toEqual([
      'pocket',
      'pocket_0',
    ]);
  });

  it('allows object-level operations to consume reference arrays stored in vars', () => {
    const ops = evalOps(`
part p {
  obj a = extrude(rect(10, 10), 1);
  obj b = extrude(rect(8, 8), 1);
  var bodies = [@a, @b];
  shell(bodies, 0.2);
}
`);
    expect(opsOfKind<IRShell>(ops, 'shell').map((op) => op.objName)).toEqual([
      'a',
      'b',
    ]);
  });

  it('allows object-level operations to index generated object arrays', () => {
    const ops = evalOps(`
part p {
  sketch base = rect(10, 10);
  sketch h = circle(1);
  obj body = extrude(base, 1);
  obj pocket = cut(h, 0.5, @body.[top, bottom]);
  shell(pocket[1], 0.2);
}
`);
    expect(opsOfKind<IRShell>(ops, 'shell').map((op) => op.objName)).toEqual([
      'pocket_0',
    ]);
  });

  it('lowers path line arrays to multiple profile segments', () => {
    const ops = evalOps(`
part p {
  sketch s = path(
    line((0, 0), (1, 0)),
    line([(2, 0), (3, 0)])
  );
}
`);
    const sketch = opsOfKind<IRSketch>(ops, 'sketch')[0];
    expect(sketch.primitive.kind).toBe('profile');
    if (sketch.primitive.kind !== 'profile') return;
    expect(sketch.primitive.segments).toHaveLength(3);
  });

  it('repeats lofts for sketch input arrays', () => {
    const ops = evalOps(`
part p {
  sketch a = rect(10, 10);
  sketch b = rect(8, 8);
  sketch top = rect(6, 6);
  obj lofted = loft([a, b], top, height: 5);
}
`);
    const lofts = opsOfKind<IRLoft>(ops, 'loft');
    expect(lofts.map((op) => op.objName)).toEqual(['lofted', 'lofted_0']);
    expect(lofts.map((op) => op.sketchNames)).toEqual([
      ['a', 'top'],
      ['b', 'top'],
    ]);
  });
});
