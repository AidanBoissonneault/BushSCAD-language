/**
 * @author Aidan Boissonneault
 * @file eval-solid-primitives.test.ts
 * @purpose Tests eval solid primitives behavior in the geometry in evaluator package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import { parse } from '@bushscad/parser';
import { resolve } from '@bushscad/resolver';
import type { IRSolidPrimitive } from '@bushscad/ir';
import { evaluate } from '../../src/index.js';

/**
 * Handles no files in the geometry flow.
 */
const noFiles = () => null;

/**
 * Evaluates ok with the current evaluation context.
 */
function evalOk(source: string): IRSolidPrimitive[] {
  const parsed = parse(source, 'solid-primitives.bscd');
  expect(parsed.errors).toHaveLength(0);
  const resolved = resolve(parsed.ast, 'solid-primitives.bscd', noFiles);
  expect(resolved.errors).toHaveLength(0);
  const result = evaluate(resolved.ast);
  expect(result.errors).toEqual([]);
  return result.program.ops.filter(
    (op): op is IRSolidPrimitive => op.kind === 'solidPrimitive',
  );
}

describe('direct solid primitive evaluation', () => {
  it('normalizes cube and cylinder args into concrete IR', () => {
    const [cube, cylinder] = evalOk(`
obj block = cube([40, 20, 8]);
obj pin = cylinder(12, d: 6);
`);
    expect(cube.shape).toMatchObject({
      primitive: 'cuboid',
      size: [40, 20, 8],
    });
    expect(cylinder.shape).toMatchObject({
      primitive: 'cylinder',
      height: 12,
      radius: 3,
    });
  });

  it('lowers trailing placement to IR placement', () => {
    const [, placed] = evalOk(`
obj base = cube([40, 20, 8]);
obj pin = cylinder(12, d: 6, @base.top.center);
`);
    expect(placed.placement).toMatchObject({ faceRef: 'base.top.center' });
  });

  it('binds unlabeled and mixed primitive arguments to their declared slots', () => {
    const [box, ball, ovalCylinder, reducer, ring, roundedSize, roundedDims] =
      evalOk(`
obj box = cube(40, 20, height: 8);
obj ball = sphere(10, 64);
obj oval_cylinder = cylinderElliptic(20, [10, 6], [8, 4], [6, 3], 48);
obj reducer = frustum(25, 12, r2: 6, segments: 32);
obj ring = torus(20, 3, 64, 24);
obj rounded_size = roundedCuboid([40, 20, 8], 2, 32);
obj rounded_dims = roundedCuboid(40, 20, 8, 2, 32);
`);

    expect(box.shape).toMatchObject({
      primitive: 'cuboid',
      size: [40, 20, 8],
    });
    expect(ball.shape).toMatchObject({
      primitive: 'sphere',
      radius: 10,
      segments: 64,
    });
    expect(ovalCylinder.shape).toMatchObject({
      primitive: 'cylinderElliptic',
      height: 20,
      startRadius: [8, 4],
      endRadius: [6, 3],
      segments: 48,
    });
    expect(reducer.shape).toMatchObject({
      primitive: 'frustum',
      height: 25,
      radiusBottom: 12,
      radiusTop: 6,
      segments: 32,
    });
    expect(ring.shape).toMatchObject({
      primitive: 'torus',
      majorRadius: 20,
      minorRadius: 3,
      majorSegments: 64,
      minorSegments: 24,
    });
    expect(roundedSize.shape).toMatchObject({
      primitive: 'roundedCuboid',
      size: [40, 20, 8],
      radius: 2,
      segments: 32,
    });
    expect(roundedDims.shape).toMatchObject({
      primitive: 'roundedCuboid',
      size: [40, 20, 8],
      radius: 2,
      segments: 32,
    });
  });

  it('uses explicit labels to fill the remaining positional slots', () => {
    const [pin] = evalOk('obj pin = cylinder(height: 12, 6);');
    expect(pin.shape).toMatchObject({
      primitive: 'cylinder',
      height: 12,
      radius: 6,
    });
  });

  it('reports unknown and duplicate primitive argument names', () => {
    const parsed = parse(
      'obj ball = sphere(radius: 10, r: 12); obj block = cube(widht: 4);',
      'solid-primitives.bscd',
    );
    const resolved = resolve(parsed.ast, 'solid-primitives.bscd', noFiles);
    const result = evaluate(resolved.ast);
    expect(result.errors.map((error) => error.message)).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Duplicate sphere argument'),
        expect.stringContaining("Unknown cube argument 'widht'"),
      ]),
    );
  });
});
