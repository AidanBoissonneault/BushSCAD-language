/**
 * @author Aidan Boissonneault
 * @file eval-within.test.ts
 * @purpose Tests eval within behavior in the statements in evaluator package.
 * @last-edited October 6, 2026
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from '@bushscad/parser';
import { resolve } from '@bushscad/resolver';
import type { IROp, IRCut } from '@bushscad/ir';
import { evaluate } from '../../src/index.js';
import { evalOk, noFiles } from '../core/test-support.js';

/**
 * Handles cut xs in the statements flow.
 */
function cutXs(ops: IROp[]): number[] {
  return (ops.filter((o) => o.kind === 'cut') as IRCut[])
    .map((c) => c.from.offsetX ?? 0)
    .sort((a, b) => a - b);
}

describe('M36 — within / auto distribution', () => {
  it('distributes a range loop with equal gaps including edges', () => {
    const { program } = evalOk(`
base_unit = mm;
part p {
    sketch base = rect(120, 100);
    obj base = extrude(base, 8);
    for i in range(4) within base.top.width {
        sketch h = circle(4);
        obj h = cut(h, through base , @base.top(x: auto, y: 14));
    }
}
`);
    // span 120 over 4 items -> gap 24 -> 24, 48, 72, 96
    expect(cutXs(program.ops)).toEqual([24, 48, 72, 96]);
  });

  it('subtracts inline fixed terms , @the span', () => {
    const { program } = evalOk(`
base_unit = mm;
part p {
    sketch base = rect(100, 60);
    obj base = extrude(base, 8);
    for i in range(2) within base.top.width {
        sketch h = circle(3);
        obj h = cut(h, through base , @base.top(x: auto + 10, y: 20));
    }
}
`);
    // F = 2*10 = 20, gap = (100-20)/3 = 26.667, auto = gap, 2*gap; +10 each
    const xs = cutXs(program.ops);
    expect(xs[0]).toBeCloseTo(80 / 3 + 10);
    expect(xs[1]).toBeCloseTo(160 / 3 + 10);
  });

  it('does not charge negative origin offsets against within spacing', () => {
    const { program } = evalOk(`
base_unit = mm;
part p {
    sketch base = rect(100, 60);
    obj base = extrude(base, 8);
    for i in range(2) within base.top.width {
        sketch h = circle(3);
        obj h = cut(h, through base , @base.top.center(x: -50 + auto, y: 20));
    }
}
`);
    const xs = cutXs(program.ops);
    expect(xs[0]).toBeCloseTo(-50 + 100 / 3);
    expect(xs[1]).toBeCloseTo(-50 + (100 / 3) * 2);
  });

  it('distributes a grid loop across both axes', () => {
    const { program } = evalOk(`
base_unit = mm;
part p {
    sketch base = rect(120, 90);
    obj base = extrude(base, 8);
    for (i, j) in grid(3, 2) within(base.top.width, base.top.height) {
        sketch h = circle(3);
        obj h = cut(h, through base , @base.top(x: auto, y: auto));
    }
}
`);
    const cuts = program.ops.filter((o) => o.kind === 'cut') as IRCut[];
    const xs = [...new Set(cuts.map((c) => c.from.offsetX))].sort(
      (a, b) => (a ?? 0) - (b ?? 0),
    );
    const ys = [...new Set(cuts.map((c) => c.from.offsetY))].sort(
      (a, b) => (a ?? 0) - (b ?? 0),
    );
    // x: span 120 / (3+1) -> 30, 60, 90 ; y: span 90 / (2+1) -> 30, 60
    expect(xs).toEqual([30, 60, 90]);
    expect(ys).toEqual([30, 60]);
  });

  it('resolves auto in a parent-face context like inset', () => {
    const { program } = evalOk(`
base_unit = mm;
part p {
    sketch base = rect(60, 40);
    obj base = extrude(base, 10);
    sketch cover = rect(auto, 12);
    obj cover = extrude(cover, 2 , @base.top.center);
}
`);
    const cover = program.ops.find(
      (o) => o.kind === 'sketch' && o.name.includes('cover'),
    );
    expect(cover && cover.kind === 'sketch' && cover.primitive).toEqual({
      kind: 'rect',
      width: 60,
      height: 12,
    });
  });

  it('errors when fixed terms exceed the span (non-positive spacing)', () => {
    const src = `
base_unit = mm;
part p {
    sketch base = rect(40, 40);
    obj base = extrude(base, 8);
    for i in range(2) within base.top.width {
        sketch h = circle(1);
        obj h = cut(h, through base , @base.top(x: auto + 60, y: 5));
    }
}
`;
    const parsed = parse(src, 'test.bscd');
    const resolved = resolve(parsed.ast, 'test.bscd', noFiles);
    const result = evaluate(resolved.ast);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0].message).toMatch(/non-positive/);
  });

  it('compiles the M36 example file without errors', () => {
    const path = fileURLToPath(
      new URL(
        '../../../../examples/test-28-M36-auto-distribution.bscd',
        import.meta.url,
      ),
    );
    evalOk(readFileSync(path, 'utf8'));
  });

  it('distributes two `auto` slots in one loop independently', () => {
    const { program } = evalOk(`
base_unit = mm;
part p {
    sketch base = rect(120, 100);
    obj base = extrude(base, 8);
    for i in range(3) within base.top.width {
        sketch a = circle(2);
        obj a = cut(a, through base , @base.top(x: auto, y: 20));
        sketch b = circle(2);
        obj b = cut(b, through base , @base.top(x: auto, y: 40));
    }
}
`);
    const cuts = program.ops.filter((o) => o.kind === 'cut') as IRCut[];
    const rowA = cuts
      .filter((c) => c.from.offsetY === 20)
      .map((c) => c.from.offsetX)
      .sort((x, y) => (x ?? 0) - (y ?? 0));
    const rowB = cuts
      .filter((c) => c.from.offsetY === 40)
      .map((c) => c.from.offsetX)
      .sort((x, y) => (x ?? 0) - (y ?? 0));
    // each row is its own distribution of 3 across span 120 -> 30, 60, 90
    expect(rowA).toEqual([30, 60, 90]);
    expect(rowB).toEqual([30, 60, 90]);
  });

  it('gives each `auto` slot its own inline fixed terms', () => {
    const { program } = evalOk(`
base_unit = mm;
part p {
    sketch base = rect(120, 100);
    obj base = extrude(base, 8);
    for i in range(3) within base.top.width {
        sketch a = circle(2);
        obj a = cut(a, through base , @base.top(x: auto, y: 20));
        sketch b = circle(2);
        obj b = cut(b, through base , @base.top(x: auto + 12, y: 40));
    }
}
`);
    const cuts = program.ops.filter((o) => o.kind === 'cut') as IRCut[];
    const rowA = cuts
      .filter((c) => c.from.offsetY === 20)
      .map((c) => c.from.offsetX);
    const rowB = cuts
      .filter((c) => c.from.offsetY === 40)
      .map((c) => c.from.offsetX);
    // A: span 120, F=0 -> gap 30 -> 30,60,90
    expect(rowA.sort((x, y) => (x ?? 0) - (y ?? 0))).toEqual([30, 60, 90]);
    // B: F = 3*12 = 36, gap = (120-36)/4 = 21 -> auto 21,42,63 ; +12 -> 33,54,75
    const sortedB = rowB.sort((x, y) => (x ?? 0) - (y ?? 0));
    expect(sortedB[0]).toBeCloseTo(33);
    expect(sortedB[2]).toBeCloseTo(75);
  });

  it('subtracts inline fixed terms in a grid loop', () => {
    const { program } = evalOk(`
base_unit = mm;
part p {
    sketch base = rect(120, 90);
    obj base = extrude(base, 8);
    for (i, j) in grid(3, 2) within(base.top.width, base.top.height) {
        sketch h = circle(2);
        obj h = cut(h, through base , @base.top(x: auto + 4, y: auto));
    }
}
`);
    const cuts = program.ops.filter((o) => o.kind === 'cut') as IRCut[];
    const xs = [...new Set(cuts.map((c) => c.from.offsetX))].sort(
      (a, b) => (a ?? 0) - (b ?? 0),
    );
    // x: F = 3*4 = 12, gap = (120-12)/4 = 27 -> auto 27,54,81 ; +4 -> 31,58,85
    expect(xs).toEqual([31, 58, 85]);
  });

  it('splits the dimension among multiple `auto`s in one parent-face expr', () => {
    const { program } = evalOk(`
base_unit = mm;
part p {
    sketch base = rect(60, 40);
    obj base = extrude(base, 10);
    sketch cover = rect(auto + auto, 12);
    obj cover = extrude(cover, 2 , @base.top.center);
}
`);
    const cover = program.ops.find(
      (o) => o.kind === 'sketch' && o.name.includes('cover'),
    );
    // two `auto`s split width 60 -> 30 each -> 30 + 30 = 60 (not 120)
    expect(cover && cover.kind === 'sketch' && cover.primitive).toEqual({
      kind: 'rect',
      width: 60,
      height: 12,
    });
  });

  it('leaves loops without a within clause unchanged', () => {
    const { program } = evalOk(`
base_unit = mm;
part p {
    sketch base = rect(120, 100);
    obj base = extrude(base, 8);
    for i in range(3) {
        sketch h = circle(3);
        obj h = cut(h, through base , @base.top(x: 10 + i * 20, y: 14));
    }
}
`);
    expect(cutXs(program.ops)).toEqual([10, 30, 50]);
  });
});
