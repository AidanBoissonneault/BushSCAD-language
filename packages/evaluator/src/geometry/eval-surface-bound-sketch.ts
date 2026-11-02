/**
 * @author Aidan Boissonneault
 * @file eval-surface-bound-sketch.ts
 * @purpose Evaluates surface bound sketch for the geometry in evaluator package.
 * @last-edited October 6, 2026
 */

import type { ASTSourceSpan, IRPlacement, SketchDecl } from '@bushscad/ir';
import type { EvalCtx } from '../core/eval-types.js';
import { addError, normalizeFaceLabel } from '../core/eval-context.js';
import { evalNum } from '../expressions/eval-expressions.js';
import { evalSingularPlacement } from '../references/eval-repeatable-refs.js';

/**
 * Resolves the placement metadata for a sketch declaration.
 * `on` sketches carry both normal placement and a clipping contract. Keeping
 * that distinction here avoids scattering soft-keyword semantics through the
 * object operation emitter.
 */
export function evalSketchPlacementInfo(
  stmt: SketchDecl,
  ctx: EvalCtx,
): { placement: IRPlacement | null; surfaceBound: IRPlacement | null } {
  const placement = stmt.placement
    ? evalSingularPlacement(
        stmt.placement.face,
        ctx,
        stmt.placement.face.span,
        stmt.placement.mode === 'on' ? 'sketch-on-surface' : 'placement',
      )
    : ctx.activePlacement;
  if (placement && stmt.placement?.angle !== undefined) {
    placement.surfaceAngleDeg = evalNum(stmt.placement.angle, ctx);
  }
  return {
    placement,
    surfaceBound:
      stmt.placement?.mode === 'on' && placement ? { ...placement } : null,
  };
}

/**
 * Records a surface-bound sketch after its primitive has been evaluated.
 * Bounded sketches remain ordinary sketch IR until a consumer turns them into
 * geometry; the evaluator must remember the face contract for that later op.
 */
export function rememberSurfaceBoundSketch(
  ctx: EvalCtx,
  sketchName: string,
  surfaceBound: IRPlacement | null,
): void {
  if (surfaceBound) ctx.surfaceBoundSketches.set(sketchName, surfaceBound);
}

/**
 * Applies the single-use rule and returns the placement a bounded consumer uses.
 * A sketch declared `on face` is local to that surface. Reusing it elsewhere
 * would make the clipping target ambiguous and violate the language contract.
 */
export function consumeSurfaceBoundSketch(
  ctx: EvalCtx,
  sketchName: string,
  consumer: string,
  explicitFrom: IRPlacement | null,
  span: ASTSourceSpan,
): IRPlacement | null {
  const bound = ctx.surfaceBoundSketches.get(sketchName);
  if (!bound) return explicitFrom;

  const uses = ctx.surfaceBoundSketchUses.get(sketchName) ?? 0;
  if (uses > 0) {
    addError(
      ctx,
      `Surface-bound sketch '${sketchName}' can only be consumed once`,
      span,
    );
  }
  ctx.surfaceBoundSketchUses.set(sketchName, uses + 1);

  if (explicitFrom && !samePlacementTarget(explicitFrom, bound)) {
    addError(
      ctx,
      `Surface-bound sketch '${sketchName}' is bound to '${bound.faceRef}' and cannot be consumed from '${explicitFrom.faceRef}'`,
      span,
    );
  }

  if (consumer !== 'extrude' && consumer !== 'cut') {
    addError(
      ctx,
      `Surface-bound sketch '${sketchName}' can only be consumed by extrude or cut`,
      span,
    );
  }

  return explicitFrom ?? bound;
}

/**
 * Checks whether the supplied placement target values are equivalent.
 */
function samePlacementTarget(a: IRPlacement, b: IRPlacement): boolean {
  return normalizeFaceLabel(a.faceRef) === normalizeFaceLabel(b.faceRef);
}
