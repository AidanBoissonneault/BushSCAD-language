/**
 * @author Aidan Boissonneault
 * @file 20-1-mounting-plate.test.ts
 * @purpose Tests 20 1 mounting plate behavior in the core in evaluator package.
 * @last-edited October 6, 2026
 */

import type {
  IRChamfer,
  IRCut,
  IRExtrude,
  IRFillet,
  IRSketch,
} from '@bushscad/ir';
import { describe, expect, it } from 'vitest';
import { evalOk, opsOfKind } from './test-support.js';

describe('spec 20.1 — mounting plate', () => {
  const SRC = `
base_unit = mm;
var plate_w = 60;
var plate_h = 40;
var plate_d = 10;
var hole_d  = 3;

part plate {
    sketch base = rect(plate_w, plate_h);
    obj base = extrude(base, plate_d);
    for (i, j) in grid(cols: 2, rows: 2, spacing_x: 44, spacing_y: 28) {
        sketch hole = circle(hole_d);
        obj hole = cut(hole, through base , @base.top.front_left(x: 8 + i, y: 6 + j));
    }
    fillet(@base.top.edges, 1.5);
    chamfer(@base.bottom.edges, 0.5);
}
`;

  it('evaluates with zero errors', () => {
    evalOk(SRC);
  });

  it('produces 12 IR ops total', () => {
    const { program } = evalOk(SRC);
    expect(program.ops).toHaveLength(12);
  });

  it('baseUnitMm = 1 (mm)', () => {
    const { program } = evalOk(SRC);
    expect(program.baseUnitMm).toBe(1);
  });

  it('defaults workplane to XY', () => {
    const { program } = evalOk(SRC);
    expect(program.workplane).toBe('XY');
  });

  it('first op: sketch base rect(60, 40)', () => {
    const { program } = evalOk(SRC);
    const op = program.ops[0] as IRSketch;
    expect(op.kind).toBe('sketch');
    expect(op.name).toBe('base');
    expect(op.primitive).toEqual({ kind: 'rect', width: 60, height: 40 });
    expect(op.placement).toBeNull();
  });

  it('second op: extrude base depth=10', () => {
    const { program } = evalOk(SRC);
    const op = program.ops[1] as IRExtrude;
    expect(op.kind).toBe('extrude');
    expect(op.objName).toBe('base');
    expect(op.sketchName).toBe('base');
    expect(op.depth).toBe(10);
    expect(op.from).toBeNull();
    expect(op.symmetric).toBe(false);
  });

  it('loop emits 4 sketch+cut pairs (8 ops)', () => {
    const { program } = evalOk(SRC);
    const loopOps = program.ops.slice(2, 10);
    expect(loopOps).toHaveLength(8);
    for (let i = 0; i < 4; i++) {
      expect(loopOps[i * 2].kind).toBe('sketch');
      expect(loopOps[i * 2 + 1].kind).toBe('cut');
    }
  });

  it('loop sketch names are unique', () => {
    const { program } = evalOk(SRC);
    const sketches = opsOfKind<IRSketch>(program.ops, 'sketch').filter(
      (s) => s.name !== 'base',
    );
    const names = sketches.map((s) => s.name);
    expect(new Set(names).size).toBe(4);
  });

  it('each cut references its own sketch', () => {
    const { program } = evalOk(SRC);
    const loopOps = program.ops.slice(2, 10);
    for (let i = 0; i < 4; i++) {
      const sk = loopOps[i * 2] as IRSketch;
      const ct = loopOps[i * 2 + 1] as IRCut;
      expect(ct.sketchName).toBe(sk.name);
      expect(ct.objName).toBe(sk.name);
    }
  });

  it('cuts are through-cuts with no depth', () => {
    const { program } = evalOk(SRC);
    const cuts = opsOfKind<IRCut>(program.ops, 'cut');
    for (const ct of cuts) {
      expect(ct.through).toBe(true);
      expect(ct.depth).toBeNull();
    }
  });

  it('cut placements resolve correct x/y offsets', () => {
    const { program } = evalOk(SRC);
    const cuts = opsOfKind<IRCut>(program.ops, 'cut');
    const offsets = cuts.map((c) => ({ x: c.from.offsetX, y: c.from.offsetY }));
    // grid with spacing: i = col*spacingX, j = row*spacingY — use directly: x = 8 + i, y = 6 + j
    expect(offsets).toContainEqual({ x: 8, y: 6 }); // col=0, row=0
    expect(offsets).toContainEqual({ x: 52, y: 6 }); // col=1, row=0
    expect(offsets).toContainEqual({ x: 8, y: 34 }); // col=0, row=1
    expect(offsets).toContainEqual({ x: 52, y: 34 }); // col=1, row=1
  });

  it('cut faceRef = base.top.corner.front_left', () => {
    const { program } = evalOk(SRC);
    const cuts = opsOfKind<IRCut>(program.ops, 'cut');
    for (const ct of cuts) {
      expect(ct.from.faceRef).toBe('base.top.corner.front_left');
    }
  });

  it('fillet deferred to end: base.top.edges r=1.5', () => {
    const { program } = evalOk(SRC);
    const op = program.ops[10] as IRFillet;
    expect(op.kind).toBe('fillet');
    expect(op.target).toBe('base.top.edges');
    expect(op.radius).toBe(1.5);
  });

  it('chamfer deferred to end: base.bottom.edges offset=0.5', () => {
    const { program } = evalOk(SRC);
    const op = program.ops[11] as IRChamfer;
    expect(op.kind).toBe('chamfer');
    expect(op.target).toBe('base.bottom.edges');
    expect(op.offset).toBe(0.5);
  });
});
