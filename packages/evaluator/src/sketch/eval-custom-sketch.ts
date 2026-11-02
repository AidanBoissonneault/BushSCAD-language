/**
 * @author Aidan Boissonneault
 * @file eval-custom-sketch.ts
 * @purpose Evaluates custom sketch for the sketch in evaluator package.
 * @last-edited October 6, 2026
 */

import type { IRPrimitive, PathSketchPrimitive } from '@bushscad/ir';
import type { EvalCtx } from '../core/eval-types.js';
import { addError } from '../core/eval-context.js';
import { evalNum } from '../expressions/eval-expressions.js';
import { solvePathConstraints } from './eval-path-constraints.js';
import { evalSketchDimensions } from './eval-sketch-dimension-decls.js';
import { evalClosedBodies } from './eval-closed-bodies.js';
import { lowerPathItems } from './eval-path-segments.js';
import { evalSketchConstraintMetadata } from './eval-sketch-constraint-metadata.js';
import { evalCompactPathDimensions } from './eval-compact-sketch-dimensions.js';
export { evalWrapSketchPrimitive } from '../geometry/eval-wrap-sketch.js';

/**
 * Lowers `path(...)` sketches to named profile segments.
 * Reusing profile IR preserves existing OCCT construction, plant handling, and
 * downstream generated-face labels while allowing cursor-based source syntax.
 */
export function evalPathSketchPrimitive(
  prim: PathSketchPrimitive,
  ctx: EvalCtx,
): IRPrimitive {
  if (prim.items.length === 0) {
    addError(ctx, 'path() requires at least one segment.', prim.span);
    return { kind: 'profile', segments: [] };
  }

  const state = lowerPathItems(prim, ctx);
  if (prim.constraints.length === 0) {
    return profileResult(prim, state.segments, undefined, ctx);
  }
  const solved = solvePathConstraints(
    state.segments,
    prim.constraints,
    prim.dimensions,
    prim.span,
    ctx,
    state,
  );
  return profileResult(prim, solved.segments, solved.constraintState, ctx);
}

/**
 * Builds the profile data required by the current operation.
 */
function profileResult(
  prim: PathSketchPrimitive,
  segments: Extract<IRPrimitive, { kind: 'profile' }>['segments'],
  constraintState: import('@bushscad/ir').IRConstraintState | undefined,
  ctx: EvalCtx,
): Extract<IRPrimitive, { kind: 'profile' }> {
  const bodyMetadata = evalClosedBodies(
    segments,
    prim.closedBodies,
    prim.ignoredClosedBodies,
    prim.bodyExpressions,
    prim.ignoredBodyExpressions,
    ctx,
  );
  const standardDimensions = evalSketchDimensions(
    prim.constraints,
    prim.dimensions,
    segments,
    ctx,
  );
  const compactDimensions = evalCompactPathDimensions(prim, ctx);
  return {
    kind: 'profile',
    segments,
    ...bodyMetadata,
    dimensions:
      standardDimensions || compactDimensions
        ? [...(standardDimensions ?? []), ...(compactDimensions ?? [])]
        : undefined,
    constraints: evalSketchConstraintMetadata(prim.constraints, segments, ctx),
    constraintState,
    placementOrigin: prim.placementOrigin
      ? [
          evalNum(prim.placementOrigin[0], ctx),
          evalNum(prim.placementOrigin[1], ctx),
        ]
      : undefined,
  };
}
