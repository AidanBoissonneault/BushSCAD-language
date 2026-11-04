import {
  segmentAngle,
  wrapAngle,
  type ConstraintSegmentPoints as SegmentPoints,
} from '../constraint-geometry.js';
import type { SolverConstraint, SolverDimension } from '../../types/types.js';
import type { ConstraintAccess } from '../constraint-access.js';
import {
  axisReferenceAngle,
  constraintValue,
} from '../residual/residual-geometry.js';
import type { ResidualContext } from '../residual/context.js';

/**
 * Appends angle to the current output.
 */
function appendAngle(
  out: number[],
  constraint: SolverConstraint,
  target: SegmentPoints | null,
  access: ConstraintAccess,
  dimensions: Map<string, SolverDimension>,
): void {
  const value = constraintValue(constraint, access, dimensions);
  if (!target || value === undefined) return;
  const desired = (value * Math.PI) / 180;
  const targetAngle = segmentAngle(target);
  if (!constraint.ref) {
    out.push(wrapAngle(targetAngle - desired));
    return;
  }
  const referenceAngle = axisReferenceAngle(constraint.ref);
  const reference = access.segment(constraint.ref);
  if (referenceAngle !== null || reference) {
    out.push(
      Math.abs(
        wrapAngle(
          targetAngle -
            (referenceAngle ?? segmentAngle(reference as SegmentPoints)),
        ),
      ) - desired,
    );
  }
}

/** Resolves the angle constraint residual. */
export function appendAngleResidual(context: ResidualContext): void {
  appendAngle(
    context.out,
    context.constraint,
    context.target,
    context.access,
    context.dimensions,
  );
}
