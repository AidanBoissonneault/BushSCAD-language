/**
 * @author Aidan Boissonneault
 * @file eval-radial.test.ts
 * @purpose Tests eval radial behavior in the geometry in evaluator package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import type { IRRadialCut, IRRadialExtrude } from '@bushscad/ir';
import { parse } from '@bushscad/parser';
import { resolve } from '@bushscad/resolver';
import { evaluate } from '../../src/index.js';
import { evalOk } from '../core/test-support.js';

describe('radial_extrude / radial_cut IR (M38)', () => {
  it('emits IRRadialExtrude with numeric extent and curve passthrough', () => {
    const { program } = evalOk(`
base_unit = mm;
part m {
    sketch p = rect(4, 2);
    obj boss = radial_extrude(p, axis: z, angle: 90, length: 20,
                              curve: ease-in-out, direction: cw,
                              start: 10, radius: 5, sections: 48);
}
`);
    const op = program.ops.find(
      (o): o is IRRadialExtrude => o.kind === 'radial_extrude',
    );
    expect(op).toBeDefined();
    expect(op!.extent).toEqual({
      kind: 'angle-length',
      angleDeg: 90,
      lengthMm: 20,
    });
    expect(op!.curve.kind).toBe('ease-in-out');
    expect(op!.direction).toBe('cw');
    expect(op!.startDeg).toBe(10);
    expect(op!.radius).toBe(5);
    expect(op!.sections).toBe(48);
    expect(op!.axis).toBe('z');
  });

  it('evaluates cubic-bezier control points to numbers', () => {
    const { program } = evalOk(`
base_unit = mm;
part m {
    sketch p = rect(4, 2);
    obj cam = radial_extrude(p, axis: z, angle: 270, length: 30,
                             curve: cubic-bezier(0.2, 0.8, 0.4, 1.0));
}
`);
    const op = program.ops.find(
      (o): o is IRRadialExtrude => o.kind === 'radial_extrude',
    );
    expect(op!.curve).toEqual({
      kind: 'cubic-bezier',
      x1: 0.2,
      y1: 0.8,
      x2: 0.4,
      y2: 1.0,
    });
  });

  it('emits paramSpans for literal angle, length, start, radius', () => {
    const { program } = evalOk(`
base_unit = mm;
part m {
    sketch p = rect(4, 2);
    obj b = radial_extrude(p, axis: z, angle: 90, length: 20,
                           start: 15, radius: 5);
}
`);
    const op = program.ops.find(
      (o): o is IRRadialExtrude => o.kind === 'radial_extrude',
    );
    expect(op!.paramSpans?.angleDeg?.literal).toBe('90');
    expect(op!.paramSpans?.lengthMm?.literal).toBe('20');
    expect(op!.paramSpans?.startDeg?.literal).toBe('15');
    expect(op!.paramSpans?.radius?.literal).toBe('5');
  });

  it('emits IRRadialCut with , @placement', () => {
    const { program } = evalOk(`
base_unit = mm;
part m {
    sketch base = rect(40, 40);
    obj base = extrude(base, 10);
    sketch slot = rect(2, 4);
    obj cutout = radial_cut(slot, axis: z, angle: 90, length: 5,
                            from: base.top.center);
}
`);
    const op = program.ops.find(
      (o): o is IRRadialCut => o.kind === 'radial_cut',
    );
    expect(op).toBeDefined();
    expect(op!.from.faceRef).toBe('base.top.center');
    expect(op!.extent.kind).toBe('angle-length');
  });

  it('errors when taper magnitude is out of range', () => {
    const parsed = parse(
      `part m {
          sketch p = rect(4, 2);
          obj boss = radial_extrude(p, axis: z, angle: 90, length: 20, taper: 90);
       }`,
      'test.bscd',
    );
    const resolved = resolve(parsed.ast, 'test.bscd', () => null);
    const result = evaluate(resolved.ast);
    expect(result.errors.some((e) => /taper/i.test(e.message))).toBe(true);
  });
});
