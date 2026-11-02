/**
 * @author Aidan Boissonneault
 * @file eval-repeatable-refs.ts
 * @purpose Evaluates repeatable refs for the references in evaluator package.
 * @last-edited October 6, 2026
 */

import type {
  ASTSourceSpan,
  IRPlacement,
  ResolvedSelectionTarget,
  RepeatableFaceRef,
  RepeatableSpatialRef,
  SpatialRef,
} from '@bushscad/ir';
import type { EvalCtx } from '../core/eval-types.js';
import { addError } from '../core/eval-context.js';
import {
  evalPlacement,
  serializeFaceRef,
} from '../expressions/eval-expressions.js';
import {
  expandRepeatableFaceRefForEval,
  expandRepeatableSpatialRefForEval,
} from './eval-reference-expansion.js';
import {
  evalResolvedSelection,
  type SelectionContext,
} from './eval-resolved-selection.js';

/**
 * Serializes every concrete target produced by a repeatable face selector.
 * Detail operations still emit one IR modifier per target. This helper keeps
 * source selector expansion separate from the IR contract.
 */
export function serializeRepeatableFaceRefs(
  ref: RepeatableFaceRef,
  ctx: EvalCtx,
): string[] {
  return expandRepeatableFaceRefForEval(ref, ctx).map((target) =>
    serializeFaceRef(target, ctx),
  );
}

/** Returns ordered, stable, de-duplicated selector targets with provenance. */
export function evalRepeatableSelectionTargets(
  ref: RepeatableFaceRef,
  ctx: EvalCtx,
  consumer: SelectionContext,
): ResolvedSelectionTarget[] {
  return evalResolvedSelection(ref, ctx, consumer).targets;
}

/**
 * Evaluates every concrete placement produced by a repeatable spatial selector.
 * Placement arrays repeat the surrounding source command while preserving the
 * existing single-placement evaluation behavior for aliases, tags, and offsets.
 */
export function evalRepeatablePlacements(
  ref: RepeatableSpatialRef,
  ctx: EvalCtx,
  consumer: SelectionContext = 'placement',
): IRPlacement[] {
  const seen = new Set<string>();
  return expandRepeatableSpatialRefForEval(ref, ctx)
    .map((target) => evalPlacement(target, ctx, consumer))
    .filter((placement) => {
      const identity = placementIdentity(placement);
      if (seen.has(identity)) return false;
      seen.add(identity);
      return true;
    });
}

/**
 * Evaluates a placement selector that must resolve to exactly one target.
 * Sketch binding and axes are singular contracts. Reporting expansion errors
 * here prevents callers from silently accepting the first wildcard result.
 */
export function evalSingularPlacement(
  ref: RepeatableSpatialRef,
  ctx: EvalCtx,
  span: ASTSourceSpan,
  consumer: SelectionContext = 'placement',
): IRPlacement {
  const placements = evalRepeatablePlacements(ref, ctx, consumer);
  if (placements.length !== 1) {
    addError(
      ctx,
      `Selector must resolve to exactly one placement; found ${placements.length}`,
      span,
    );
    return placements[0] ?? { faceRef: 'world.center' };
  }
  return placements[0] ?? { faceRef: 'world.center' };
}

/**
 * Expands spatial refs into its concrete entries.
 */
export function expandSpatialRefs(
  ref: RepeatableSpatialRef,
  ctx: EvalCtx,
): SpatialRef[] {
  return expandRepeatableSpatialRefForEval(ref, ctx);
}

/**
 * Handles placement identity in the references flow.
 */
function placementIdentity(placement: IRPlacement): string {
  return JSON.stringify([
    placement.selection?.targets.map((target) => target.id) ??
      placement.faceRef,
    placement.offsetX,
    placement.offsetY,
    placement.offsetZ,
    placement.radius,
    placement.angleDeg,
    placement.surfaceAngleDeg,
  ]);
}
