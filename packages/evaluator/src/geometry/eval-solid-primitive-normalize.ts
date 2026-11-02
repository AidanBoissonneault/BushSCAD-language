/**
 * @author Aidan Boissonneault
 * @file eval-solid-primitive-normalize.ts
 * @purpose Evaluates solid primitive normalize for the geometry in evaluator package.
 * @last-edited October 6, 2026
 */

import type { IRSolidPrimitiveShape, SolidPrimitiveOp } from '@bushscad/ir';
import type { EvalCtx } from '../core/eval-types.js';
import {
  type ArgBag,
  argBag,
  evalArg,
  faceList,
  named,
  numArg,
  optionalNum,
  optionalRadius,
  pointList,
  positive,
  positiveVec2,
  positiveVec3,
  radiusArg,
  segments,
  sizeValue,
  vec2Arg,
  vec3Arg,
} from './eval-solid-primitive-values.js';

/**
 * Defines the `PrimitiveNormalizer` callback contract used by the geometry layer.
 */
type PrimitiveNormalizer = (
  op: SolidPrimitiveOp,
  args: ArgBag,
  ctx: EvalCtx,
) => IRSolidPrimitiveShape;

const PRIMITIVE_NORMALIZERS: Record<
  SolidPrimitiveOp['primitive'],
  PrimitiveNormalizer
> = {
  cube: (op, args, ctx) => normalizeCuboid('cube', args, ctx, op.span),
  cuboid: (op, args, ctx) => normalizeCuboid('cuboid', args, ctx, op.span),
  roundedCuboid: (op, args, ctx) => ({
    ...normalizeCuboid('roundedCuboid', args, ctx, op.span),
    primitive: 'roundedCuboid',
  }),
  sphere: (op, args, ctx) => normalizeSphere(op, args, ctx),
  geodesicSphere: (op, args, ctx) => normalizeSphere(op, args, ctx),
  ellipsoid: (op, args, ctx) => normalizeEllipsoid(op, args, ctx),
  cylinder: (op, args, ctx) =>
    normalizeCylinder('cylinder', args, ctx, op.span),
  roundedCylinder: (op, args, ctx) =>
    normalizeRoundedCylinder(args, ctx, op.span),
  cylinderElliptic: (op, args, ctx) =>
    normalizeEllipticCylinder(args, ctx, op.span),
  cone: (op, args, ctx) => normalizeCone(args, ctx, op.span),
  frustum: (op, args, ctx) => normalizeFrustum(args, ctx, op.span),
  torus: (op, args, ctx) => normalizeTorus(args, ctx, op.span),
  polyhedron: (op, args, ctx) => normalizePolyhedron(args, ctx, op.span),
};

/**
 * Normalizes source-compatible solid primitive arguments into concrete IR.
 * Primitive syntax intentionally accepts OpenSCAD and JSCAD-style aliases, but
 * the bridge should receive one validated shape contract per primitive.
 */
export function normalizeSolidPrimitive(
  op: SolidPrimitiveOp,
  ctx: EvalCtx,
): IRSolidPrimitiveShape {
  return PRIMITIVE_NORMALIZERS[op.primitive](op, argBag(op.args), ctx);
}

/**
 * Normalizes sphere into the canonical form.
 */
function normalizeSphere(
  op: SolidPrimitiveOp,
  args: ArgBag,
  ctx: EvalCtx,
): IRSolidPrimitiveShape {
  return {
    primitive: op.primitive === 'geodesicSphere' ? 'geodesicSphere' : 'sphere',
    radius: positive(radiusArg(args, ctx, 1), 'sphere radius', op.span, ctx),
    segments: segments(args, ctx),
  };
}

/**
 * Normalizes ellipsoid into the canonical form.
 */
function normalizeEllipsoid(
  op: SolidPrimitiveOp,
  args: ArgBag,
  ctx: EvalCtx,
): IRSolidPrimitiveShape {
  return {
    primitive: 'ellipsoid',
    radius: positiveVec3(
      vec3Arg(args, ctx, ['radius', 'r'], [1, 1, 1]),
      'ellipsoid radius',
      op.span,
      ctx,
    ),
    segments: segments(args, ctx),
  };
}

/**
 * Normalizes cuboid into the canonical form.
 */
function normalizeCuboid(
  primitive: 'cube' | 'cuboid' | 'roundedCuboid',
  args: ArgBag,
  ctx: EvalCtx,
  span: SolidPrimitiveOp['span'],
): Extract<IRSolidPrimitiveShape, { primitive: 'cuboid' | 'roundedCuboid' }> {
  const sizeArg = named(args, ['size']) ?? args.positional[0];
  const size = sizeArg
    ? sizeValue(sizeArg.value, ctx)
    : ([
        numArg(args, ctx, ['width', 'x'], -1, 1),
        numArg(args, ctx, ['depth', 'y'], -1, 1),
        numArg(args, ctx, ['height', 'z'], -1, 1),
      ] as [number, number, number]);
  return {
    primitive: primitive === 'roundedCuboid' ? 'roundedCuboid' : 'cuboid',
    size: positiveVec3(size, `${primitive} size`, sizeArg?.span ?? span, ctx),
    radius: optionalNum(args, ctx, ['radius', 'r']),
    segments: segments(args, ctx),
  };
}

/**
 * Normalizes cylinder into the canonical form.
 */
function normalizeCylinder(
  primitive: 'cylinder' | 'roundedCylinder',
  args: ArgBag,
  ctx: EvalCtx,
  span: SolidPrimitiveOp['span'],
): Extract<
  IRSolidPrimitiveShape,
  { primitive: 'cylinder' | 'roundedCylinder' }
> {
  const height = positive(
    numArg(args, ctx, ['height', 'h'], 0, 1),
    'cylinder height',
    span,
    ctx,
  );
  const radius = radiusArg(args, ctx, 1);
  return {
    primitive,
    height,
    radius: positive(radius, 'cylinder radius', span, ctx),
    radiusTop: optionalRadius(args, ctx, [
      'r2',
      'radiusTop',
      'topRadius',
      'd2',
      'diameterTop',
    ]),
    radiusBottom: optionalRadius(args, ctx, [
      'r1',
      'radiusBottom',
      'bottomRadius',
      'd1',
      'diameterBottom',
    ]),
    segments: segments(args, ctx),
  };
}

/**
 * Normalizes rounded cylinder into the canonical form.
 */
function normalizeRoundedCylinder(
  args: ArgBag,
  ctx: EvalCtx,
  span: SolidPrimitiveOp['span'],
): IRSolidPrimitiveShape {
  const cylinder = normalizeCylinder('roundedCylinder', args, ctx, span);
  return {
    ...cylinder,
    primitive: 'roundedCylinder',
    roundingRadius: positive(
      optionalNum(args, ctx, ['roundingRadius', 'roundRadius', 'fillet']) ?? 0,
      'roundedCylinder rounding radius',
      span,
      ctx,
      true,
    ),
  };
}

/**
 * Normalizes cone into the canonical form.
 */
function normalizeCone(
  args: ArgBag,
  ctx: EvalCtx,
  span: SolidPrimitiveOp['span'],
): IRSolidPrimitiveShape {
  return {
    primitive: 'cone',
    height: positive(
      numArg(args, ctx, ['height', 'h'], 0, 1),
      'cone height',
      span,
      ctx,
    ),
    radiusBottom: positive(radiusArg(args, ctx, 1), 'cone radius', span, ctx),
    radiusTop: 0,
    segments: segments(args, ctx),
  };
}

/**
 * Normalizes frustum into the canonical form.
 */
function normalizeFrustum(
  args: ArgBag,
  ctx: EvalCtx,
  span: SolidPrimitiveOp['span'],
): IRSolidPrimitiveShape {
  return {
    primitive: 'frustum',
    height: positive(
      numArg(args, ctx, ['height', 'h'], 0, 1),
      'frustum height',
      span,
      ctx,
    ),
    radiusBottom: positive(
      optionalRadius(args, ctx, ['d1', 'diameterBottom']) ??
        numArg(args, ctx, ['r1', 'radiusBottom', 'bottomRadius'], 1, 1),
      'frustum bottom radius',
      span,
      ctx,
    ),
    radiusTop: positive(
      optionalRadius(args, ctx, ['d2', 'diameterTop']) ??
        numArg(args, ctx, ['r2', 'radiusTop', 'topRadius'], 2, 0.5),
      'frustum top radius',
      span,
      ctx,
      true,
    ),
    segments: segments(args, ctx),
  };
}

/**
 * Normalizes elliptic cylinder into the canonical form.
 */
function normalizeEllipticCylinder(
  args: ArgBag,
  ctx: EvalCtx,
  span: SolidPrimitiveOp['span'],
): Extract<IRSolidPrimitiveShape, { primitive: 'cylinderElliptic' }> {
  const radius = vec2Arg(args, ctx, ['radius', 'r'], [1, 1]);
  return {
    primitive: 'cylinderElliptic',
    height: positive(
      numArg(args, ctx, ['height', 'h'], 0, 1),
      'cylinderElliptic height',
      span,
      ctx,
    ),
    startRadius: positiveVec2(
      vec2Arg(args, ctx, ['startRadius', 'radiusStart', 'r1'], radius),
      'cylinderElliptic startRadius',
      span,
      ctx,
    ),
    endRadius: positiveVec2(
      vec2Arg(args, ctx, ['endRadius', 'radiusEnd', 'r2'], radius),
      'cylinderElliptic endRadius',
      span,
      ctx,
    ),
    segments: segments(args, ctx),
  };
}

/**
 * Normalizes torus into the canonical form.
 */
function normalizeTorus(
  args: ArgBag,
  ctx: EvalCtx,
  span: SolidPrimitiveOp['span'],
): IRSolidPrimitiveShape {
  return {
    primitive: 'torus',
    majorRadius: positive(
      numArg(args, ctx, ['majorRadius', 'outerRadius', 'ro'], 0, 10),
      'torus majorRadius',
      span,
      ctx,
    ),
    minorRadius: positive(
      numArg(args, ctx, ['minorRadius', 'innerRadius', 'ri'], 1, 2),
      'torus minorRadius',
      span,
      ctx,
    ),
    majorSegments: segments(args, ctx),
    minorSegments: Math.max(
      8,
      Math.round(
        optionalNum(args, ctx, ['minorSegments', 'tubeSegments']) ?? 16,
      ),
    ),
  };
}

/**
 * Normalizes polyhedron into the canonical form.
 */
function normalizePolyhedron(
  args: ArgBag,
  ctx: EvalCtx,
  span: SolidPrimitiveOp['span'],
): Extract<IRSolidPrimitiveShape, { primitive: 'polyhedron' }> {
  return {
    primitive: 'polyhedron',
    points: pointList(evalArg(args, ctx, ['points'], 0), span, ctx),
    faces: faceList(evalArg(args, ctx, ['faces', 'triangles'], 1), span, ctx),
  };
}
