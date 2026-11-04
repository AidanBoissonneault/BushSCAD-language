/**
 * @author Aidan Boissonneault
 * @file m7-5-parent-context-sketching.test.ts
 * @purpose Tests m7 5 parent context sketching behavior in the core in evaluator package.
 * @last-edited October 6, 2026
 */

import type { IRChamfer, IRFillet, IRShell, IRSketch } from '@bushscad/ir';
import { parse } from '@bushscad/parser';
import { resolve } from '@bushscad/resolver';
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/index.js';
import { evalOk, noFiles, opsOfKind } from './test-support.js';

/**
 * Evaluates a parent-context inset sketch and returns the lowered lid primitive.
 *
 * Why:
 * The inset cases differ only by inset syntax and expected dimensions; sharing
 * the surrounding model keeps the tests focused on that semantic difference.
 */
function evalInsetLidPrimitive(
  insetExpression: string,
): IRSketch['primitive'] | undefined {
  const { program } = evalOk(`
base_unit = mm;
part p {
    sketch base = rect(60, 40);
    obj base = extrude(base, 10);
    sketch lid = rect inset(${insetExpression});
    obj lid = extrude(lid, 2 , @base.top.center);
}
`);
  return opsOfKind<IRSketch>(program.ops, 'sketch').find(
    (s) => s.name === 'lid',
  )?.primitive;
}

describe('M7.5 parent context sketching', () => {
  it('resolves this.width/height inside a placed component , @parent face metrics', () => {
    const { program } = evalOk(`
base_unit = mm;
part cover {
    sketch face = rect(this.width - 4, this.height - 6);
    obj face = extrude(face, 2);
}
part plate {
    sketch base = rect(60, 40);
    obj base = extrude(base, 10);
    place(cover, @base.top.center);
}
`);
    const cover = opsOfKind<IRSketch>(program.ops, 'sketch').find(
      (s) => s.name !== 'base',
    );
    expect(cover?.primitive).toEqual({ kind: 'rect', width: 56, height: 34 });
    expect(cover?.placement?.faceRef).toBe('base.top.center');
  });

  it('lowers rect inset(all) , @parent face metrics', () => {
    expect(evalInsetLidPrimitive('10')).toEqual({
      kind: 'rect',
      width: 40,
      height: 20,
    });
  });

  it('lowers rect inset(x/y) , @parent face metrics', () => {
    expect(evalInsetLidPrimitive('x: 5, y: 10')).toEqual({
      kind: 'rect',
      width: 50,
      height: 20,
    });
  });

  it('reports inset without a parent context as an evaluator error', () => {
    const parsed = parse('sketch lid = rect inset(5);', 'test.bscd');
    expect(parsed.errors).toHaveLength(0);
    const resolved = resolve(parsed.ast, 'test.bscd', noFiles);
    expect(resolved.errors).toHaveLength(0);
    const result = evaluate(resolved.ast);
    expect(
      result.errors.some((e) => e.message.includes('parent sketching context')),
    ).toBe(true);
  });

  it('attaches named anchors to placed component sketch placements', () => {
    const { program } = evalOk(`
base_unit = mm;
export part bracket {
    sketch body = rect(10, 10);
    obj body = extrude(body, 2);
    @mount = @body.bottom.front_left;
}
part p {
    sketch base = rect(60, 40);
    obj base = extrude(base, 10);
    place(bracket, @base.top.center, @mount);
}
`);
    const placed = opsOfKind<IRSketch>(program.ops, 'sketch').find(
      (s) => s.placement?.faceRef === 'base.top.center',
    );
    expect(placed?.placement?.faceRef).toBe('base.top.center');
    expect(placed?.placement?.anchorRef).toContain('.bottom.corner.front_left');
  });

  it('resolves this.width for components placed on inner side faces', () => {
    const { program } = evalOk(`
base_unit = mm;
export ref bracket {
    sketch body = rect(this.width / 2, 4);
    obj body = extrude(body, 1);
    @center = @body.bottom.center;
}
part p {
    sketch base = rect(60, 40);
    obj base = extrude(base, 10);
    place(bracket, @base.inner.back.center, @center);
}
`);
    const placed = opsOfKind<IRSketch>(program.ops, 'sketch').find(
      (s) => s.name !== 'base',
    );
    expect(placed?.primitive).toMatchObject({
      kind: 'rect',
      width: 30,
      height: 4,
    });
  });

  it('lowers side-placed component chains with local feature, inset, and shell details', () => {
    const { program } = evalOk(`
base_unit = mm;
export part child {
    sketch body = rect(8, 6);
    obj body = extrude(body, 4);
    sketch hole = circle(2);
    obj hole = cut(hole, 1 , @body.top.center);
    fillet(@body.top.edges, 0.25);
    fillet(@hole.top.edges, 0.1);
    @mount = @body.bottom.center;
}
export ref inset_child {
    sketch panel = rect inset(2);
    obj panel = extrude(panel, 2);
    chamfer(@panel.bottom.edges, 0.2);
    @mount = @panel.bottom.center;
}
export part shelled_child {
    sketch cup = rect(8, 8);
    obj cup = extrude(cup, 5);
    shell(cup, 0.5, open: top);
    @mount = @cup.bottom.center;
}
part p {
    sketch base = rect(60, 40);
    obj base = extrude(base, 10);
    place(child, @base.front.center, @mount);
    place(inset_child, @base.back.center, @mount);
    place(shelled_child, @base.left.center, @mount);
}
`);

    const fillets = opsOfKind<IRFillet>(program.ops, 'fillet');
    expect(fillets.map((f) => f.target)).toEqual(
      expect.arrayContaining([expect.stringMatching(/\.top\.edges$/)]),
    );
    expect(
      fillets.some(
        (f) => f.target.includes('hole') && f.target.endsWith('.top.edges'),
      ),
    ).toBe(true);

    const chamfers = opsOfKind<IRChamfer>(program.ops, 'chamfer');
    expect(
      chamfers.some(
        (c) => c.target.includes('panel') && c.target.endsWith('.bottom.edges'),
      ),
    ).toBe(true);

    const shell = opsOfKind<IRShell>(program.ops, 'shell')[0];
    expect(shell.openFaces).toEqual(['top']);

    const insetPanel = opsOfKind<IRSketch>(program.ops, 'sketch').find((s) =>
      s.name.includes('panel'),
    );
    expect(insetPanel?.primitive).toMatchObject({
      kind: 'rect',
      width: 56,
      height: 6,
    });
  });
});
