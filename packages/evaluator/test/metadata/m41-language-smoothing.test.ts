/**
 * @author Aidan Boissonneault
 * @file m41-language-smoothing.test.ts
 * @purpose Tests m41 language smoothing behavior in the metadata in evaluator package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import type { IRCut, IRExtrude, IRSketch } from '@bushscad/ir';
import { evalOps } from '../core/test-support.js';

describe('M41 language expectation smoothing evaluation', () => {
  it('emits hidden inline sketches before consuming operations', () => {
    const ops = evalOps(`
part p {
  obj base = extrude(rect(60, 40), 10);
}`);
    const sketch = ops.find((op): op is IRSketch => op.kind === 'sketch');
    const extrude = ops.find((op): op is IRExtrude => op.kind === 'extrude');
    expect(sketch?.name).toMatch(/^__inline_base_sketch_/);
    expect(extrude?.sketchName).toBe(sketch?.name);
  });

  it('places inline extrude sketches like named sketch declarations', () => {
    const ops = evalOps(`
part inline_child {
  obj cyl = extrude(circle(28), 34);
}
part named_child {
  sketch cylinder_profile = circle(28);
  obj cyl = extrude(cylinder_profile, 34);
}
part base {
  obj base = extrude(rect(100, 100), 5);
  place(inline_child, @base.top.center(radius: 30, angle: 0deg));
  place(named_child, @base.top.center(radius: 30, angle: 180deg));
}`);
    const sketches = ops.filter((op): op is IRSketch => op.kind === 'sketch');
    const inlineSketch = sketches.find(
      (sketch) =>
        sketch.name.startsWith('__inline_cyl_sketch_') &&
        sketch.placement?.angleDeg === 0,
    );
    const namedSketch = sketches.find(
      (sketch) =>
        sketch.name.startsWith('cylinder_profile_') &&
        sketch.placement?.angleDeg === 180,
    );

    expect(inlineSketch?.placement).toMatchObject({
      faceRef: 'base.top.center',
      radius: 30,
      angleDeg: 0,
    });
    expect(namedSketch?.placement).toMatchObject({
      faceRef: 'base.top.center',
      radius: 30,
      angleDeg: 180,
    });
  });

  it('infers through target , @the placement surface', () => {
    const ops = evalOps(`
part p {
  obj base = extrude(rect(60, 40), 10);
  obj hole = cut(circle(4), through , @base.top(20, 20));
}`);
    const cut = ops.find((op): op is IRCut => op.kind === 'cut');
    expect(cut?.through).toBe(true);
    expect(cut?.throughTarget).toBe('base');
  });

  it('returns numeric face and sketch dimensions with length compatibility', () => {
    const ops = evalOps(`
part p {
  sketch profile = rect(20, 10);
  obj base = extrude(profile, 5);
  sketch from_face = rect(base.top.width, base.top.height);
  sketch legacy = rect(profile.width, profile.length);
}`);
    const sketches = ops.filter((op): op is IRSketch => op.kind === 'sketch');
    expect(sketches.find((s) => s.name === 'from_face')?.primitive).toEqual({
      kind: 'rect',
      width: 20,
      height: 10,
    });
    expect(sketches.find((s) => s.name === 'legacy')?.primitive).toEqual({
      kind: 'rect',
      width: 20,
      height: 10,
    });
  });

  it('uses numeric variables in within clauses', () => {
    const ops = evalOps(`
part p {
  var span = 120;
  obj base = extrude(rect(120, 40), 8);
  for i in range(3) within span {
    obj h = cut(circle(3), through , @base.top(x: auto, y: 10));
  }
}`);
    const xs = ops
      .filter((op): op is IRCut => op.kind === 'cut')
      .map((cut) => cut.from.offsetX)
      .sort((a, b) => (a ?? 0) - (b ?? 0));
    expect(xs).toEqual([30, 60, 90]);
  });
});
