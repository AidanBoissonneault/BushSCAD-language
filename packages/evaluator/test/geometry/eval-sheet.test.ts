/**
 * @author Aidan Boissonneault
 * @file eval-sheet.test.ts
 * @purpose Tests eval sheet behavior in the geometry in evaluator package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import { parse } from '@bushscad/parser';
import { resolve } from '@bushscad/resolver';
import type { IRFlange, IRFlatPattern } from '@bushscad/ir';
import { evaluate } from '../../src/index.js';

/**
 * Evaluates ok with the current evaluation context.
 */
function evalOk(source: string) {
  const parsed = parse(source, 'test.bscd');
  const resolved = resolve(parsed.ast, 'test.bscd', () => null);
  expect([...parsed.errors, ...resolved.errors]).toHaveLength(0);
  const result = evaluate(resolved.ast);
  expect(result.errors).toHaveLength(0);
  return result;
}

/**
 * Handles compile errors in the geometry flow.
 */
function compileErrors(source: string): string[] {
  const parsed = parse(source, 'test.bscd');
  const resolved = resolve(parsed.ast, 'test.bscd', () => null);
  const result = evaluate(resolved.ast);
  return [...parsed.errors, ...resolved.errors, ...result.errors].map(
    (e) => e.message,
  );
}

const BRACKET = `
sheet bracket thickness: 2 bend_radius: 1 k_factor: 0.44 {
  sketch base = rect(80, 40);
  obj base = sheet_base(base);
  flange base.edge(front) length: 20 angle: 90deg radius: 1;
  flange base.edge(back) length: 15 angle: 90deg radius: 1 direction: down;
  export flat_pattern dxf './exports/bracket-flat.dxf';
}
`;

describe('sheet metal evaluation (M33)', () => {
  it('lowers a sheet block to a part, base extrude, flanges, and flat pattern', () => {
    const result = evalOk(BRACKET);
    const ops = result.program.ops;
    expect(ops.find((o) => o.kind === 'part')).toMatchObject({
      name: 'bracket',
    });
    expect(ops.find((o) => o.kind === 'extrude')).toMatchObject({
      objName: 'base',
      sketchName: 'base__panel',
      depth: 2,
    });
    const flanges = ops.filter((o): o is IRFlange => o.kind === 'flange');
    expect(flanges).toHaveLength(2);
    expect(flanges[0]).toMatchObject({ objName: 'base', edgeName: 'front' });
    expect(flanges[0].profile).toHaveLength(6);
    expect(ops.filter((o) => o.kind === 'flat_pattern')).toHaveLength(1);
  });

  it('reduces the base panel so flanges fold out of the rectangle', () => {
    const result = evalOk(BRACKET);
    const polygon = result.program.ops.find(
      (o) => o.kind === 'sketch' && o.name === 'base__panel',
    );
    // base rect 80x40; front flange 20 + back flange 15 → reduced y range [0, 5].
    expect(polygon).toMatchObject({
      primitive: {
        kind: 'polygon',
        points: [
          [-40, 0],
          [40, 0],
          [40, 5],
          [-40, 5],
        ],
      },
    });
  });

  it('computes bend allowance BA = angle * (r + k*t) for flat-pattern bend lines', () => {
    const result = evalOk(BRACKET);
    const fp = result.program.ops.find(
      (o): o is IRFlatPattern => o.kind === 'flat_pattern',
    )!;
    // front flange: angle 90deg, r=1, k=0.44, t=2 → BA = (pi/2)*(1 + 0.88)
    const expectedBA = (Math.PI / 2) * (1 + 0.44 * 2);
    const bendLines = fp.segments.filter((s) => s.layer === 'BEND');
    // Front reduced edge sits at y = -20 + 20 = 0; the bend zone runs to -BA.
    const offsetLine = bendLines.find(
      (s) => Math.abs(s.y1 - -expectedBA) < 1e-6,
    );
    expect(offsetLine).toBeDefined();
  });

  it('rejects a non-positive bend radius', () => {
    const errors = compileErrors(`
      sheet s thickness: 2 {
        sketch base = rect(40, 40);
        obj base = sheet_base(base);
        flange base.edge(front) length: 10 angle: 90deg radius: -1;
      }
    `);
    expect(errors.some((m) => m.includes('bend radius must be positive'))).toBe(
      true,
    );
  });

  it('rejects an out-of-range bend angle', () => {
    const errors = compileErrors(`
      sheet s thickness: 2 {
        sketch base = rect(40, 40);
        obj base = sheet_base(base);
        flange base.edge(front) length: 10 angle: 200deg;
      }
    `);
    expect(errors.some((m) => m.includes('between 0 and 180'))).toBe(true);
  });

  it('rejects two flanges on the same edge', () => {
    const errors = compileErrors(`
      sheet s thickness: 2 {
        sketch base = rect(40, 40);
        obj base = sheet_base(base);
        flange base.edge(front) length: 10 angle: 90deg;
        flange base.edge(front) length: 12 angle: 90deg;
      }
    `);
    expect(errors.some((m) => m.includes('already has a flange'))).toBe(true);
  });
});
