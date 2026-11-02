/**
 * @author Aidan Boissonneault
 * @file eval-profile-validation.ts
 * @purpose Evaluates profile validation for the sketch in evaluator package.
 * @last-edited October 6, 2026
 */

import type { ASTSourceSpan, IRPrimitive } from '@bushscad/ir';
import { profileSegmentsAreClosed } from '@bushscad/ir';
import type { EvalCtx } from '../core/eval-types.js';
import { addError } from '../core/eval-context.js';

const GEOM_EPS = 1e-7;

/**
 * Creates point geometry from the supplied coordinates.
 */
function pointDistance(a: [number, number], b: [number, number]): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

/** Returns true if the profile sketch forms a closed loop. */
export function profileClosed(prim: IRPrimitive | undefined): boolean {
  if (!prim || prim.kind !== 'profile') return true;
  return profileSegmentsAreClosed(prim.segments);
}

/** Adds an error if the named sketch is an open profile. */
export function requireClosedSketch(
  ctx: EvalCtx,
  sketchName: string,
  opName: string,
  span: ASTSourceSpan,
): void {
  const prim = ctx.sketches.get(sketchName);
  if (prim?.kind === 'profile' && !profileClosed(prim)) {
    addError(
      ctx,
      `Sketch '${sketchName}' is open and cannot be ${closedSketchVerb(opName)} as a solid. Use close() or wrap() to create a closed profile.`,
      span,
    );
  }
}

/**
 * Handles closed sketch verb in the sketch flow.
 */
function closedSketchVerb(opName: string): string {
  if (opName.includes('extrude')) return 'extruded';
  if (opName.includes('revolve')) return 'revolved';
  if (opName.includes('loft')) return 'lofted';
  if (opName.includes('cut')) return 'cut';
  if (opName.includes('sweep')) return 'swept';
  return `${opName}ed`;
}

/** Adds an error if the guide sketch is not an open profile. */
export function requireOpenGuideSketch(
  ctx: EvalCtx,
  guideName: string,
  span: ASTSourceSpan,
): void {
  const prim = ctx.sketches.get(guideName);
  if (!prim) return;
  if (prim.kind !== 'profile') {
    addError(
      ctx,
      `loft guide '${guideName}' must be a line/arc path sketch`,
      span,
    );
    return;
  }
  if (profileClosed(prim)) {
    addError(ctx, `loft guide '${guideName}' must be open`, span);
  }
}

/** Validates a radius arc can span its chord. */
export function validateArcRadius(
  name: string,
  from: [number, number],
  to: [number, number],
  radius: number,
  span: ASTSourceSpan,
  ctx: EvalCtx,
): void {
  const halfChord = pointDistance(from, to) / 2;
  if (radius <= 0)
    addError(ctx, `Arc segment '${name}' radius must be positive`, span);
  if (radius + GEOM_EPS < halfChord) {
    addError(
      ctx,
      `Arc segment '${name}' radius must be at least half the chord length`,
      span,
    );
  }
}
