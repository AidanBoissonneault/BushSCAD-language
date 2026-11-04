/**
 * @author Aidan Boissonneault
 * @file normalize-solid-primitive.ts
 * @purpose Dispatches solid primitive normalization to shape-specific modules.
 * @last-edited November 4, 2026
 */

import type { SolidPrimitiveOp } from '@bushscad/ir';
import type { EvalCtx } from '../../core/eval-types.js';
import { argBag } from '../eval-solid-primitive-values.js';
import type { PrimitiveNormalizer } from './types.js';
import { normalizeCone } from './cone/normalize-cone.js';
import { normalizeCuboid } from './cuboid/normalize-cuboid.js';
import { normalizeCylinder } from './cylinder/normalize-cylinder.js';
import { normalizeEllipsoid } from './ellipsoid/normalize-ellipsoid.js';
import { normalizeEllipticCylinder } from './elliptic-cylinder/normalize-elliptic-cylinder.js';
import { normalizeFrustum } from './frustum/normalize-frustum.js';
import { normalizePolyhedron } from './polyhedron/normalize-polyhedron.js';
import { normalizeRoundedCylinder } from './rounded-cylinder/normalize-rounded-cylinder.js';
import { normalizeSphere } from './sphere/normalize-sphere.js';
import { normalizeTorus } from './torus/normalize-torus.js';

const PRIMITIVE_NORMALIZERS: Record<
  SolidPrimitiveOp['primitive'],
  PrimitiveNormalizer
> = {
  cube: (operation, args, ctx) =>
    normalizeCuboid('cube', args, ctx, operation.span),
  cuboid: (operation, args, ctx) =>
    normalizeCuboid('cuboid', args, ctx, operation.span),
  roundedCuboid: (operation, args, ctx) =>
    normalizeCuboid('roundedCuboid', args, ctx, operation.span),
  sphere: normalizeSphere,
  geodesicSphere: normalizeSphere,
  ellipsoid: normalizeEllipsoid,
  cylinder: (operation, args, ctx) =>
    normalizeCylinder('cylinder', args, ctx, operation.span),
  roundedCylinder: (operation, args, ctx) =>
    normalizeRoundedCylinder(args, ctx, operation.span),
  cylinderElliptic: (operation, args, ctx) =>
    normalizeEllipticCylinder(args, ctx, operation.span),
  cone: (operation, args, ctx) => normalizeCone(args, ctx, operation.span),
  frustum: (operation, args, ctx) => normalizeFrustum(args, ctx, operation.span),
  torus: (operation, args, ctx) => normalizeTorus(args, ctx, operation.span),
  polyhedron: (operation, args, ctx) =>
    normalizePolyhedron(args, ctx, operation.span),
};

/**
 * Converts source aliases and overloads into the bridge's concrete shape form.
 *
 * Why:
 * Per-shape modules own validation and normalization while this function
 * retains the single evaluator entrypoint used by solid object operations.
 */
export function normalizeSolidPrimitive(
  operation: SolidPrimitiveOp,
  ctx: EvalCtx,
) {
  return PRIMITIVE_NORMALIZERS[operation.primitive](
    operation,
    argBag(operation, ctx),
    ctx,
  );
}
