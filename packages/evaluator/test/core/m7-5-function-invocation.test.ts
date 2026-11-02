/**
 * @author Aidan Boissonneault
 * @file m7-5-function-invocation.test.ts
 * @purpose Tests m7 5 function invocation behavior in the core in evaluator package.
 * @last-edited October 6, 2026
 */

import type { IRCut, IRSketch } from '@bushscad/ir';
import { describe, expect, it } from 'vitest';
import { evalErrorMessages, evalOk, opsOfKind } from './test-support.js';

describe('M7.5 function invocation', () => {
  it('evaluates standalone function calls in caller scope', () => {
    const { program } = evalOk(`
base_unit = mm;
fn bolt_hole(d) {
    sketch h = circle(d);
    obj h = cut(h, through base , @base.top.center);
}
part p {
    sketch base = rect(60, 40);
    obj base = extrude(base, 10);
    bolt_hole(3);
}
`);
    const cuts = opsOfKind<IRCut>(program.ops, 'cut');
    expect(cuts).toHaveLength(1);
    expect(cuts[0].from.faceRef).toBe('base.top.center');
  });

  it('evaluates placed function calls with parent placement context', () => {
    const { program } = evalOk(`
base_unit = mm;
fn boss(d) {
    sketch b = circle(d);
    obj b = extrude(b, 4);
}
part p {
    sketch base = rect(60, 40);
    obj base = extrude(base, 10);
    place(boss(8), @base.top(x: 10, y: 12));
}
`);
    const bossSketch = opsOfKind<IRSketch>(program.ops, 'sketch').find(
      (s) => s.name !== 'base',
    );
    expect(bossSketch?.primitive).toEqual({ kind: 'circle', diameter: 8 });
    expect(bossSketch?.placement).toMatchObject({
      faceRef: 'base.top',
      offsetX: 10,
      offsetY: 12,
    });
  });

  it('binds positional arguments after named arguments to the next open parameter', () => {
    const { program } = evalOk(`
fn block(width, height) {
    sketch body = rect(width, height);
    obj body = extrude(body, 1);
}
part p {
    sketch base = rect(50, 50);
    obj base = extrude(base, 2);
    place(block(width: 10, 20), @base.top.center);
}
`);
    const blockSketch = opsOfKind<IRSketch>(program.ops, 'sketch').find(
      (sketch) => sketch.name !== 'base',
    );

    expect(blockSketch?.primitive).toMatchObject({
      kind: 'rect',
      width: 10,
      height: 20,
    });
  });

  it('reports unknown, duplicate, and excess function arguments', () => {
    const messages = evalErrorMessages(`
fn pin(d) {
    sketch shape = circle(d);
    obj shape = extrude(shape, 1);
}
part p {
    pin(d: 4, diameter: 6);
    pin(d: 4, d: 6);
    pin(4, 6);
}
`);

    expect(messages).toEqual(
      expect.arrayContaining([
        "Function 'pin' does not accept argument 'diameter'",
        "Function 'pin' got duplicate argument 'd'",
        "Function 'pin' accepts at most 1 positional argument(s)",
      ]),
    );
  });

  it('evaluates return blocks with placement-scoped cuts', () => {
    const { program } = evalOk(`
base_unit = mm;
fn cs_hole(pilot_d, cs_d, depth) {
    sketch pilot = circle(pilot_d);
    sketch cs = circle(cs_d);
    return {
        obj pilot = cut(pilot, depth),
        obj cs = cut(cs, depth * 0.4),
    }
}
part p {
    sketch base = rect(60, 40);
    obj base = extrude(base, 10);
    place(cs_hole(3, 6, 3), @base.top.center(x: 5, y: 6));
}
`);
    const cuts = opsOfKind<IRCut>(program.ops, 'cut');
    expect(cuts).toHaveLength(2);
    expect(cuts[0].depth).toBe(3);
    expect(cuts[1].depth).toBeCloseTo(1.2);
    expect(cuts[0].from).toMatchObject({
      faceRef: 'base.top.center',
      offsetX: 5,
      offsetY: 6,
    });
    expect(cuts[1].from).toMatchObject({
      faceRef: 'base.top.center',
      offsetX: 5,
      offsetY: 6,
    });
  });

  it('freshens return block local names for repeated placed function calls', () => {
    const { program } = evalOk(`
base_unit = mm;
fn cs_hole(pilot_d, cs_d, depth) {
    sketch pilot = circle(pilot_d);
    sketch cs = circle(cs_d);
    return {
        obj pilot = cut(pilot, depth),
        obj cs = cut(cs, depth * 0.4),
    }
}
part p {
    sketch base = rect(60, 40);
    obj base = extrude(base, 10);
    for pt in [
        @base.top.center(x: 5, y: 6),
        @base.top.center(x: 15, y: 16)
    ] {
        place(cs_hole(3, 6, 3), @pt);
    }
}
`);
    const cuts = opsOfKind<IRCut>(program.ops, 'cut');
    expect(cuts).toHaveLength(4);
    expect(new Set(cuts.map((c) => c.objName)).size).toBe(4);
    expect(new Set(cuts.map((c) => c.sketchName)).size).toBe(4);
  });

  it('reports placement-scoped cuts without active placement', () => {
    const source = `
base_unit = mm;
fn cs_hole(pilot_d, cs_d, depth) {
    sketch pilot = circle(pilot_d);
    sketch cs = circle(cs_d);
    return {
        obj pilot = cut(pilot, depth),
        obj cs = cut(cs, depth * 0.4),
    }
}
part p {
    sketch base = rect(60, 40);
    obj base = extrude(base, 10);
    cs_hole(3, 6, 3);
}
`;
    const messages = evalErrorMessages(source);
    expect(
      messages.some((message) =>
        message.includes(
          'without a spatial argument requires a placement context',
        ),
      ),
    ).toBe(true);
  });
});
