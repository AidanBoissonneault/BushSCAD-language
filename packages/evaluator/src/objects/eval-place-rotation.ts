/**
 * @author Aidan Boissonneault
 * @file eval-place-rotation.ts
 * @purpose Evaluates place rotation for the objects in evaluator package.
 * @last-edited October 6, 2026
 */

import type { IRPlacement, PlaceStatement } from '@bushscad/ir';
import type { EvalCtx } from '../core/eval-types.js';
import { evalNum } from '../expressions/eval-expressions.js';

const ROTATION_AXES = ['x', 'y', 'z'] as const;

/**
 * Applies the optional rotation suffix on a place statement.
 * Rotation is part of placement lowering rather than component evaluation, so
 * source anchors and function calls all see one normalized target placement.
 */
export function withPlacementRotation(
  placement: IRPlacement,
  rotate: NonNullable<PlaceStatement['rotate']> | null,
  ctx: EvalCtx,
): IRPlacement {
  if (rotate === null) return placement;
  return rotate.kind === 'default'
    ? withDefaultPlacementRotation(placement, rotate, ctx)
    : withAxisPlacementRotation(placement, rotate, ctx);
}

/**
 * Handles with default placement rotation in the objects flow.
 */
function withDefaultPlacementRotation(
  placement: IRPlacement,
  rotate: Extract<NonNullable<PlaceStatement['rotate']>, { kind: 'default' }>,
  ctx: EvalCtx,
): IRPlacement {
  const angle = evalNum(rotate.angle, ctx);
  if (angle === 0) return placement;
  return { ...placement, rotationDeg: (placement.rotationDeg ?? 0) + angle };
}

/**
 * Handles with axis placement rotation in the objects flow.
 */
function withAxisPlacementRotation(
  placement: IRPlacement,
  rotate: Extract<NonNullable<PlaceStatement['rotate']>, { kind: 'axes' }>,
  ctx: EvalCtx,
): IRPlacement {
  const axisRotationDeg = { ...(placement.axisRotationDeg ?? {}) };
  for (const axis of ROTATION_AXES) {
    const expr = rotate[axis];
    if (expr)
      axisRotationDeg[axis] = (axisRotationDeg[axis] ?? 0) + evalNum(expr, ctx);
  }
  if (axisRotationIsEmpty(axisRotationDeg)) return placement;
  return { ...placement, axisRotationDeg };
}

/**
 * Builds the axis data required by the current operation.
 */
function axisRotationIsEmpty(
  axisRotationDeg: NonNullable<IRPlacement['axisRotationDeg']>,
): boolean {
  return ROTATION_AXES.every((axis) => (axisRotationDeg[axis] ?? 0) === 0);
}
