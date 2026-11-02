/**
 * @author Aidan Boissonneault
 * @file variable.test.ts
 * @purpose Tests variable behavior in the core in evaluator package.
 * @last-edited October 6, 2026
 */

import type { IRSketch } from '@bushscad/ir';
import { describe, expect, it } from 'vitest';
import {
  evalErrorMessages,
  evalOk,
  resolveErrorMessages,
} from './test-support.js';

describe('variable evaluation', () => {
  it('arithmetic expressions', () => {
    const { program } = evalOk(`
base_unit = mm;
var a = 10;
var b = a * 2 + 5;
part p {
    sketch s = rect(a, b);
    obj s = extrude(s, 3);
}
`);
    const sk = program.ops[0] as IRSketch;
    expect(sk.primitive).toEqual({ kind: 'rect', width: 10, height: 25 });
  });

  it('ternary expression', () => {
    const { program } = evalOk(`
base_unit = mm;
var thick = true;
part p {
    sketch s = rect(10, thick ? 20 : 10);
    obj s = extrude(s, 5);
}
`);
    const sk = program.ops[0] as IRSketch;
    expect((sk.primitive as { height: number }).height).toBe(20);
  });

  it('env fallback used', () => {
    const { program } = evalOk(`
base_unit = mm;
env d fallback 5;
part p {
    sketch s = circle(d);
    obj s = extrude(s, 3);
}
`);
    const sk = program.ops[0] as IRSketch;
    expect((sk.primitive as { diameter: number }).diameter).toBe(5);
  });

  it('lowers sketch boolean subtraction and local placement', () => {
    const { program } = evalOk(`
base_unit = mm;
part p {
    sketch s = circle(10) - circle(2) at (3, 0);
    obj s = extrude(s, 1);
}
`);
    const sk = program.ops[0] as IRSketch;
    expect(sk.primitive).toMatchObject({
      kind: 'sketchBoolean',
      op: 'subtract',
      right: { kind: 'sketchAt', x: 3, y: 0 },
    });
  });

  it('supports word operands in sketch booleans', () => {
    const { program } = evalOk(`
base_unit = mm;
part p {
    sketch s = rect(12, 8) - word('A', size: 4);
    obj s = extrude(s, 1);
}
`);
    const sk = program.ops[0] as IRSketch;
    expect(sk.primitive.kind).toBe('sketchBoolean');
    if (sk.primitive.kind === 'sketchBoolean') {
      expect(sk.primitive.right.kind).toBe('word');
    }
  });

  it('lowers named sketch operands in sketch booleans', () => {
    const { program } = evalOk(`
base_unit = mm;
part p {
    sketch outer = circle(10);
    sketch inner = circle(4);
    sketch ring = outer - inner at (2, 0);
    obj ring = extrude(ring, 1);
}
`);
    const ring = program.ops.find(
      (op): op is IRSketch => op.kind === 'sketch' && op.name === 'ring',
    );
    expect(ring?.primitive).toMatchObject({
      kind: 'sketchBoolean',
      op: 'subtract',
      left: { kind: 'circle', diameter: 10 },
      right: { kind: 'sketchAt', x: 2, y: 0 },
    });
  });

  it('evaluates sketch width and length , @sketch bounds', () => {
    const { program } = evalOk(`
base_unit = mm;
part p {
    sketch base = rect(20, 8);
    sketch copy = rect(base.width + 2, base.length + 4);
    obj copy = extrude(copy, 1);
}
`);
    const copy = program.ops.find(
      (op): op is IRSketch => op.kind === 'sketch' && op.name === 'copy',
    );
    expect(copy?.primitive).toEqual({ kind: 'rect', width: 22, height: 12 });
  });

  it('reports undefined named sketch operands', () => {
    const messages = resolveErrorMessages(
      'part p { sketch ring = outer - circle(2); }',
    );
    expect(
      messages.some((message) =>
        message.includes("Undefined sketch 'outer' in sketch expression"),
      ),
    ).toBe(true);
  });

  it('reports open profile operands in sketch booleans', () => {
    const messages = evalErrorMessages(`
base_unit = mm;
part p {
    sketch gap = path(line((0, 0), (5, 0))) - circle(1);
}
`);
    expect(
      messages.some((message) =>
        message.includes('Sketch boolean operands must be closed'),
      ),
    ).toBe(true);
  });
});
