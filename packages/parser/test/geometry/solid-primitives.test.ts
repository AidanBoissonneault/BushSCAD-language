/**
 * @author Aidan Boissonneault
 * @file solid-primitives.test.ts
 * @purpose Tests solid primitives behavior in the geometry in parser package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import type { ObjDecl, SolidPrimitiveOp } from '@bushscad/ir';
import { parse } from '../../src/index.js';

/**
 * Parses primitive from the supplied source into the geometry representation.
 */
function parsePrimitive(source: string): SolidPrimitiveOp {
  const result = parse(source, 'solid-primitives.bscd');
  expect(result.errors).toEqual([]);
  const obj = result.ast.statements[0] as ObjDecl;
  expect(obj.operation.kind).toBe('solidPrimitive');
  return obj.operation as SolidPrimitiveOp;
}

describe('direct solid primitive syntax', () => {
  it('parses all supported primitive names as obj operations', () => {
    const names = [
      'cube',
      'cuboid',
      'sphere',
      'ellipsoid',
      'geodesicSphere',
      'cylinder',
      'cylinderElliptic',
      'cone',
      'frustum',
      'roundedCuboid',
      'roundedCylinder',
      'torus',
      'polyhedron',
    ];
    for (const name of names) {
      const op = parsePrimitive(`obj p = ${name}(1);`);
      expect(op.primitive).toBe(name);
    }
  });

  it('parses trailing placement separately from value args', () => {
    const op = parsePrimitive('obj p = cylinder(12, d: 6, @base.top.center);');
    expect(op.args).toHaveLength(2);
    expect(op.placement?.kind).toBe('faceRef');
  });
});
