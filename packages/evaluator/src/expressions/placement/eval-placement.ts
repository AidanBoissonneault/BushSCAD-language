import type { Expr, FaceRef, IRPlacement, PosRef } from '@bushscad/ir';
import type { EvalCtx } from '../../core/eval-types.js';
import { isFaceRefValue, isIRPlacement } from '../../core/eval-types.js';
import {
  countAuto,
  exprContainsAuto,
} from '../../core/eval-auto-expression-walk.js';
import { uniqueFixedTerms } from '../../core/eval-auto-fixed-terms.js';
import {
  evalResolvedSelection,
  type SelectionContext,
} from '../../references/eval-resolved-selection.js';
import {
  serializeFaceRef,
  serializeFaceRefSegments,
} from '../../references/eval-face-expressions.js';
import type { EvalNumberExpression } from '../evaluation-contract.js';

/**
 * Evaluates placement with the current evaluation context.
 */
export function resolvePlacement(
  ref: FaceRef | PosRef,
  ctx: EvalCtx,
  evalNumber: EvalNumberExpression,
  selectionContext: SelectionContext = 'placement',
): IRPlacement {
  if (ref.kind === 'pos')
    return resolvePositionPlacement(ref, ctx, evalNumber, selectionContext);
  const alias = ctx.spatialAliases.get(spatialAliasKey(ref));
  if (alias) return { ...alias };
  const selection = evalResolvedSelection(ref, ctx, selectionContext);
  if (ref.chain.length === 1 && ref.chain[0].kind === 'name') {
    const tag = ctx.tags.get(ref.chain[0].value);
    if (tag) return { faceRef: tag.label, selection };
    const val = ctx.values.get(ref.chain[0].value);
    if (isIRPlacement(val)) return val;
    if (isFaceRefValue(val)) return { faceRef: val.label, selection };
    return {
      faceRef: `${ctx.names.get(ref.chain[0].value) ?? ref.chain[0].value}.center`,
      selection,
    };
  }
  const placement: IRPlacement = {
    faceRef: serializeFaceRef(ref, ctx),
    selection,
  };
  if (faceRefRoot(ref) === 'origin') placement.workplane = ctx.workplane;
  if (ref.surfaceAngle !== undefined) {
    placement.surfaceAngleDeg = evalNumber(ref.surfaceAngle, ctx);
  }
  return placement;
}

/**
 * Handles spatial alias key in the expressions flow.
 */
function spatialAliasKey(ref: FaceRef): string {
  return serializeFaceRefSegments(ref.chain, {} as EvalCtx, false);
}

/**
 * Evaluates pos to placement with the current evaluation context.
 */
export function resolvePositionPlacement(
  ref: PosRef,
  ctx: EvalCtx,
  evalNumber: EvalNumberExpression,
  selectionContext: SelectionContext = 'placement',
): IRPlacement {
  const base = Array.isArray(ref.anchor)
    ? {
        faceRef: `${evalNumber(ref.anchor[0], ctx)},${evalNumber(ref.anchor[1], ctx)},${evalNumber(ref.anchor[2], ctx)}`,
      }
    : (ctx.spatialAliases.get(spatialAliasKey(ref.anchor)) ?? {
        faceRef: serializeFaceRef(ref.anchor, ctx),
        selection: evalResolvedSelection(ref.anchor, ctx, selectionContext),
      });
  const p: IRPlacement = { ...base };
  if (!Array.isArray(ref.anchor) && faceRefRoot(ref.anchor) === 'origin') {
    p.workplane = ctx.workplane;
  }
  if (!Array.isArray(ref.anchor) && ref.anchor.surfaceAngle !== undefined) {
    p.surfaceAngleDeg = evalNumber(ref.anchor.surfaceAngle, ctx);
  }
  if (ref.x !== undefined)
    p.offsetX = resolveAxisExpression(ref.x, 'x', ctx, evalNumber);
  if (ref.y !== undefined)
    p.offsetY = resolveAxisExpression(ref.y, 'y', ctx, evalNumber);
  if (ref.radius !== undefined) p.radius = evalNumber(ref.radius, ctx);
  if (ref.angle !== undefined) p.angleDeg = evalNumber(ref.angle, ctx);
  if (ref.offset !== undefined) p.offsetZ = evalNumber(ref.offset, ctx);
  return p;
}

/** Returns the first named segment, which identifies built-in placement roots. */
function faceRefRoot(ref: FaceRef): string | null {
  const first = ref.chain.find((segment) => segment.kind === 'name');
  return first?.kind === 'name' ? first.value : null;
}

/**
 * Evaluates an x/y argument expression, resolving any `auto` against the given
 * axis. Inside a `within` loop the loop's plan supplies the value; otherwise,
 * in a parent-face context, the axis dimension is split among the `auto`s in
 * this expression.
 */
export function resolveAxisExpression(
  expr: Expr,
  axis: 'x' | 'y',
  ctx: EvalCtx,
  evalNumber: EvalNumberExpression,
): number {
  const prevAxis = ctx.autoAxis;
  const prevAutoContext = ctx.autoContext;
  ctx.autoAxis = axis;
  let restoreContext = false;
  if (!ctx.autoGroups && ctx.thisContext && exprContainsAuto(expr)) {
    const k = countAuto(expr);
    if (k > 0) {
      const dim = axis === 'y' ? ctx.thisContext.height : ctx.thisContext.width;
      const share = (dim - fixedTermsSum(expr, ctx, evalNumber)) / k;
      ctx.autoContext = { ...(ctx.autoContext ?? {}), [axis]: share };
      restoreContext = true;
    }
  }
  const value = evalNumber(expr, ctx);
  if (restoreContext) ctx.autoContext = prevAutoContext;
  ctx.autoAxis = prevAxis;
  return value;
}

/**
 * Sums the non-`auto` inline offset terms for one expression.
 * Parent-face auto sizing must subtract fixed terms before distributing the
 * remaining axis length across auto occurrences.
 */
function fixedTermsSum(
  e: Expr,
  ctx: EvalCtx,
  evalNumber: EvalNumberExpression,
): number {
  let total = 0;
  for (const term of uniqueFixedTerms(e)) {
    total += term.sign * evalNumber(term.expr, ctx);
  }
  return total;
}
