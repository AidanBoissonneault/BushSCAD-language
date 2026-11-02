/**
 * @author Aidan Boissonneault
 * @file eval-solid-primitive-metrics.ts
 * @purpose Evaluates solid primitive metrics for the geometry in evaluator package.
 * @last-edited October 6, 2026
 */

import type { IRSolidPrimitiveShape } from '@bushscad/ir';
import type { EvalCtx } from '../core/eval-types.js';

/**
 * Selected members of IRSolidPrimitiveShape used for box shape.
 */
type BoxShape = Extract<
  IRSolidPrimitiveShape,
  { primitive: 'cuboid' | 'roundedCuboid' }
>;
/**
 * Selected members of IRSolidPrimitiveShape used for cylinder shape.
 */
type CylinderShape = Extract<
  IRSolidPrimitiveShape,
  { primitive: 'cylinder' | 'roundedCylinder' }
>;
/**
 * Selected members of IRSolidPrimitiveShape used for sphere shape.
 */
type SphereShape = Extract<
  IRSolidPrimitiveShape,
  { primitive: 'sphere' | 'geodesicSphere' }
>;
/**
 * Selected members of IRSolidPrimitiveShape used for tapered shape.
 */
type TaperedShape = Extract<
  IRSolidPrimitiveShape,
  { primitive: 'cone' | 'frustum' }
>;

/**
 * Defines the `PrimitiveExtentReader` callback contract used by the geometry layer.
 */
type PrimitiveExtentReader = (
  shape: IRSolidPrimitiveShape,
) => [number, number, number];

const PRIMITIVE_EXTENTS: Record<
  IRSolidPrimitiveShape['primitive'],
  PrimitiveExtentReader
> = {
  cuboid: (shape) => (shape as BoxShape).size,
  roundedCuboid: (shape) => (shape as BoxShape).size,
  sphere: (shape) => sphereExtents(shape),
  geodesicSphere: (shape) => sphereExtents(shape),
  ellipsoid: (shape) => {
    const ellipsoid = shape as Extract<
      IRSolidPrimitiveShape,
      { primitive: 'ellipsoid' }
    >;
    return [
      ellipsoid.radius[0] * 2,
      ellipsoid.radius[1] * 2,
      ellipsoid.radius[2] * 2,
    ];
  },
  torus: (shape) => {
    const torus = shape as Extract<
      IRSolidPrimitiveShape,
      { primitive: 'torus' }
    >;
    const d = (torus.majorRadius + torus.minorRadius) * 2;
    return [d, d, torus.minorRadius * 2];
  },
  cylinderElliptic: (shape) => {
    const cylinder = shape as Extract<
      IRSolidPrimitiveShape,
      { primitive: 'cylinderElliptic' }
    >;
    return [
      cylinder.startRadius[0] * 2,
      cylinder.startRadius[1] * 2,
      cylinder.height,
    ];
  },
  polyhedron: (shape) =>
    polyhedronExtents(
      (shape as Extract<IRSolidPrimitiveShape, { primitive: 'polyhedron' }>)
        .points,
    ),
  cylinder: (shape) => cylinderExtents(shape),
  roundedCylinder: (shape) => cylinderExtents(shape),
  cone: (shape) => taperedExtents(shape),
  frustum: (shape) => taperedExtents(shape),
};

/**
 * Registers symbolic dimensions for direct 3D primitive objects.
 * `this.*`, placement helpers, and downstream UI features expect generated
 * solids to expose the same basic top/bottom metrics as sketch-built solids.
 */
export function registerSolidPrimitiveMetrics(
  ctx: EvalCtx,
  name: string,
  shape: IRSolidPrimitiveShape,
): void {
  const [width, height, depth] = primitiveExtents(shape);
  ctx.solidMetrics.set(name, { width, height, depth });
  ctx.faceMetrics.set(`${name}.top`, {
    width,
    height,
    area: width * height,
    normal: 'z+',
    center: { faceRef: `${name}.top.center` },
  });
  ctx.faceMetrics.set(`${name}.bottom`, {
    width,
    height,
    area: width * height,
    normal: 'z-',
    center: { faceRef: `${name}.bottom.center` },
  });
}

/**
 * Builds the primitive data required by the current operation.
 */
function primitiveExtents(
  shape: IRSolidPrimitiveShape,
): [number, number, number] {
  return PRIMITIVE_EXTENTS[shape.primitive](shape);
}

/**
 * Handles sphere extents in the geometry flow.
 */
function sphereExtents(shape: IRSolidPrimitiveShape): [number, number, number] {
  const sphere = shape as SphereShape;
  return [sphere.radius * 2, sphere.radius * 2, sphere.radius * 2];
}

/**
 * Handles cylinder extents in the geometry flow.
 */
function cylinderExtents(
  shape: IRSolidPrimitiveShape,
): [number, number, number] {
  const cylinder = shape as CylinderShape;
  const r = Math.max(
    cylinder.radiusTop ?? cylinder.radius,
    cylinder.radiusBottom ?? cylinder.radius,
  );
  return [r * 2, r * 2, cylinder.height];
}

/**
 * Handles tapered extents in the geometry flow.
 */
function taperedExtents(
  shape: IRSolidPrimitiveShape,
): [number, number, number] {
  const tapered = shape as TaperedShape;
  const r = Math.max(tapered.radiusTop, tapered.radiusBottom);
  return [r * 2, r * 2, tapered.height];
}

/**
 * Handles polyhedron extents in the geometry flow.
 */
function polyhedronExtents(
  points: [number, number, number][],
): [number, number, number] {
  if (points.length === 0) return [0, 0, 0];
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const zs = points.map(([, , z]) => z);
  return [
    Math.max(...xs) - Math.min(...xs),
    Math.max(...ys) - Math.min(...ys),
    Math.max(...zs) - Math.min(...zs),
  ];
}
