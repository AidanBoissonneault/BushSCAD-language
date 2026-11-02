/**
 * @author Aidan Boissonneault
 * @file eval-reference-this.ts
 * @purpose Evaluates reference this for the statements in evaluator package.
 * @last-edited October 6, 2026
 */

import type {
  FaceRef,
  PathInput,
  PosRef,
  RepeatableFaceRef,
  RepeatableSpatialRef,
  SurfaceInput,
} from '@bushscad/ir';
import {
  expandRepeatableFaceRef,
  expandRepeatableSpatialRef,
} from '@bushscad/ir';
import { exprUsesThis } from '../sketch/eval-sketch-this.js';

/** Reports whether a repeatable face selector contains a `this.` expression. */
export function repeatableFaceRefUsesThis(ref: RepeatableFaceRef): boolean {
  return expandRepeatableFaceRef(ref).some(faceRefUsesThis);
}

/** Reports whether any expanded placement depends on the caller's context. */
export function placementUsesThis(ref: RepeatableSpatialRef): boolean {
  return expandRepeatableSpatialRef(ref).some((item) =>
    item.kind === 'pos' ? posUsesThis(item) : faceRefUsesThis(item),
  );
}

/** Reports whether a face reference's placement angle uses `this.`. */
export function faceRefUsesThis(ref: FaceRef): boolean {
  return ref.surfaceAngle ? exprUsesThis(ref.surfaceAngle) : false;
}

/** Reports whether inline path coordinates depend on the caller's context. */
export function pathInputUsesThis(input: PathInput): boolean {
  return (
    input.kind === 'inlinePath' &&
    input.primitive.points.some(
      (point) =>
        exprUsesThis(point.x) || exprUsesThis(point.y) || exprUsesThis(point.z),
    )
  );
}

/** Reports whether a nested surface operation depends on `this.`. */
export function surfaceInputUsesThis(input: SurfaceInput): boolean {
  if (input.kind === 'namedSurface') return false;
  const operation = input.operation;
  return operation.kind === 'fill'
    ? repeatableFaceRefUsesThis(operation.boundary)
    : surfaceInputUsesThis(operation.surface) ||
        exprUsesThis(operation.distance);
}

/**
 * Handles pos uses this in the statements flow.
 */
function posUsesThis(ref: PosRef): boolean {
  return (
    (Array.isArray(ref.anchor)
      ? ref.anchor.some(exprUsesThis)
      : faceRefUsesThis(ref.anchor)) ||
    [ref.x, ref.y, ref.radius, ref.angle, ref.offset].some((expression) =>
      expression ? exprUsesThis(expression) : false,
    )
  );
}
