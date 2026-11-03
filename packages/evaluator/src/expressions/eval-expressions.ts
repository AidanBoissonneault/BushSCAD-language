/**
 * @author Aidan Boissonneault
 * @file eval-expressions.ts
 * @purpose Evaluates expressions for the expressions in evaluator package.
 * @last-edited October 6, 2026
 */

import type {
  Expr,
  FaceRef,
  IRFontRef,
  IRPlacement,
  PosRef,
} from '@bushscad/ir';
import type { EvalCtx, EvalValue } from '../core/eval-types.js';
import {
  isFaceRefValue,
  isIRFontAssetRef,
  isIRPlacement,
  valueType,
} from '../core/eval-types.js';
import { addError } from '../core/eval-context.js';
import {
  countAuto,
  exprContainsAuto,
} from '../core/eval-auto-expression-walk.js';
import { uniqueFixedTerms } from '../core/eval-auto-fixed-terms.js';
import { evalAutoExpr } from './eval-auto-expression.js';
import { evalBinaryValue, isNumericBinaryOperator } from './eval-binary.js';
import {
  evalFaceRefExpr,
  evalFaceRefListExpr,
  serializeFaceRef,
  serializeFaceRefSegments,
} from '../references/eval-face-expressions.js';
import {
  evalResolvedSelection,
  type SelectionContext,
} from '../references/eval-resolved-selection.js';
import { unitToMm } from './eval-environment-values.js';

export { evalEnvDecl, unitToMm } from './eval-environment-values.js';

export {
  FACE_WORDS,
  asFaceRefValue,
  evalFaceRefExpr,
  serializeAnchorTarget,
  serializeFaceRef,
  serializeFaceRefSegments,
} from '../references/eval-face-expressions.js';

/**
 * Evaluates placement with the current evaluation context.
 */
export function evalPlacement(
  ref: FaceRef | PosRef,
  ctx: EvalCtx,
  selectionContext: SelectionContext = 'placement',
): IRPlacement {
  if (ref.kind === 'pos') return evalPosToPlacement(ref, ctx, selectionContext);
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
  if (ref.surfaceAngle !== undefined) {
    placement.surfaceAngleDeg = evalNum(ref.surfaceAngle, ctx);
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
export function evalPosToPlacement(
  ref: PosRef,
  ctx: EvalCtx,
  selectionContext: SelectionContext = 'placement',
): IRPlacement {
  const base = Array.isArray(ref.anchor)
    ? {
        faceRef: `${evalNum(ref.anchor[0], ctx)},${evalNum(ref.anchor[1], ctx)},${evalNum(ref.anchor[2], ctx)}`,
      }
    : (ctx.spatialAliases.get(spatialAliasKey(ref.anchor)) ?? {
        faceRef: serializeFaceRef(ref.anchor, ctx),
        selection: evalResolvedSelection(ref.anchor, ctx, selectionContext),
      });
  const p: IRPlacement = { ...base };
  if (!Array.isArray(ref.anchor) && ref.anchor.surfaceAngle !== undefined) {
    p.surfaceAngleDeg = evalNum(ref.anchor.surfaceAngle, ctx);
  }
  if (ref.x !== undefined) p.offsetX = evalAxisExpr(ref.x, 'x', ctx);
  if (ref.y !== undefined) p.offsetY = evalAxisExpr(ref.y, 'y', ctx);
  if (ref.radius !== undefined) p.radius = evalNum(ref.radius, ctx);
  if (ref.angle !== undefined) p.angleDeg = evalNum(ref.angle, ctx);
  if (ref.offset !== undefined) p.offsetZ = evalNum(ref.offset, ctx);
  return p;
}

/**
 * Evaluates an x/y argument expression, resolving any `auto` against the given
 * axis. Inside a `within` loop the loop's plan supplies the value; otherwise,
 * in a parent-face context, the axis dimension is split among the `auto`s in
 * this expression.
 */
export function evalAxisExpr(
  expr: Expr,
  axis: 'x' | 'y',
  ctx: EvalCtx,
): number {
  const prevAxis = ctx.autoAxis;
  const prevAutoContext = ctx.autoContext;
  ctx.autoAxis = axis;
  let restoreContext = false;
  if (!ctx.autoGroups && ctx.thisContext && exprContainsAuto(expr)) {
    const k = countAuto(expr);
    if (k > 0) {
      const dim = axis === 'y' ? ctx.thisContext.height : ctx.thisContext.width;
      const share = (dim - fixedTermsSum(expr, ctx)) / k;
      ctx.autoContext = { ...(ctx.autoContext ?? {}), [axis]: share };
      restoreContext = true;
    }
  }
  const value = evalNum(expr, ctx);
  if (restoreContext) ctx.autoContext = prevAutoContext;
  ctx.autoAxis = prevAxis;
  return value;
}

/**
 * Sums the non-`auto` inline offset terms for one expression.
 * Parent-face auto sizing must subtract fixed terms before distributing the
 * remaining axis length across auto occurrences.
 */
function fixedTermsSum(e: Expr, ctx: EvalCtx): number {
  let total = 0;
  for (const term of uniqueFixedTerms(e)) {
    total += term.sign * evalNum(term.expr, ctx);
  }
  return total;
}

/**
 * Evaluates the interpolated expression parts and joins them into one string.
 * This keeps template coercion out of the main expression dispatcher.
 */
function evalTemplateExpr(
  expr: Extract<Expr, { kind: 'template' }>,
  ctx: EvalCtx,
): string {
  return expr.parts
    .map((part) =>
      part.kind === 'text'
        ? part.value
        : String(evalExpr(part.expression, ctx)),
    )
    .join('');
}

/**
 * Evaluates a binary expression and records invalid numeric operands.
 */
function evalBinaryExpr(
  expr: Extract<Expr, { kind: 'binary' }>,
  ctx: EvalCtx,
): EvalValue {
  const left = evalExpr(expr.left, ctx);
  const right = evalExpr(expr.right, ctx);
  if (
    isNumericBinaryOperator(expr.op) &&
    (typeof left !== 'number' || typeof right !== 'number')
  ) {
    addError(ctx, `Operator '${expr.op}' requires numeric operands`, expr.span);
    return 0;
  }
  return evalBinaryValue(expr.op, left, right, 0);
}

/**
 * Evaluates a unary expression and reports invalid numeric negation.
 */
function evalUnaryExpr(
  expr: Extract<Expr, { kind: 'unary' }>,
  ctx: EvalCtx,
): EvalValue {
  const value = evalExpr(expr.operand, ctx);
  if (expr.op === '!') return !value;
  if (typeof value !== 'number') {
    addError(ctx, `Unary '-' requires a numeric operand`, expr.span);
    return 0;
  }
  return -value;
}

/**
 * Evaluates expr with the current evaluation context.
 */
export function evalExpr(expr: Expr, ctx: EvalCtx): EvalValue {
  switch (expr.kind) {
    case 'number':
      return expr.value;
    case 'string':
      return expr.value;
    case 'template':
      return evalTemplateExpr(expr, ctx);
    case 'bool':
      return expr.value;
    case 'list':
      return expr.items.map((item) => evalExpr(item, ctx));
    case 'tuple':
      return [evalNum(expr.x, ctx), evalNum(expr.y, ctx)] as const;
    case 'identifier':
      return evalIdentifier(expr, ctx);
    case 'binary':
      return evalBinaryExpr(expr, ctx);
    case 'unary':
      return evalUnaryExpr(expr, ctx);
    case 'ternary':
      return evalExpr(expr.condition, ctx)
        ? evalExpr(expr.then, ctx)
        : evalExpr(expr.else, ctx);
    case 'unit':
      return evalUnitExpr(expr, ctx);
    case 'this':
      return evalThisExpr(expr, ctx);
    case 'faceRef':
      return evalFaceRefExpr(expr, ctx);
    case 'faceRefList':
      return evalFaceRefListExpr(expr, ctx);
    case 'pos':
      return evalPosToPlacement(expr, ctx);
    case 'call':
      addError(ctx, `User-defined function calls not yet supported`, expr.span);
      return 0;
    case 'auto':
      return evalAutoExpr(expr, ctx);
  }
  return 0;
}

/**
 * Evaluates identifier with the current evaluation context.
 */
function evalIdentifier(
  expr: Extract<Expr, { kind: 'identifier' }>,
  ctx: EvalCtx,
): EvalValue {
  const val = ctx.values.get(expr.name);
  if (val !== undefined) return val;
  const tag = ctx.tags.get(expr.name);
  if (tag) return tag;
  addError(ctx, `Undefined variable '${expr.name}'`, expr.span);
  return 0;
}

/**
 * Evaluates unit expr with the current evaluation context.
 */
function evalUnitExpr(
  expr: Extract<Expr, { kind: 'unit' }>,
  ctx: EvalCtx,
): number {
  const val = evalNum(expr.value, ctx);
  if (expr.unit === 'deg') return val;
  return (
    (val * unitToMm(expr.unit as 'mm' | 'cm' | 'm' | 'in' | 'ft')) /
    ctx.baseUnitMm
  );
}

/**
 * Evaluates this expr with the current evaluation context.
 */
function evalThisExpr(
  expr: Extract<Expr, { kind: 'this' }>,
  ctx: EvalCtx,
): EvalValue {
  if (!ctx.thisContext) {
    addError(
      ctx,
      `'this.${expr.property}' requires a parent sketching context`,
      expr.span,
    );
    return 0;
  }
  switch (expr.property) {
    case 'width':
      return ctx.thisContext.width;
    case 'height':
      return ctx.thisContext.height;
    case 'area':
      return ctx.thisContext.area;
    case 'center':
      return ctx.thisContext.center;
    case 'normal':
      return ctx.thisContext.normal;
  }
}

/**
 * Evaluates a finite number for a numeric-only language input.
 *
 * Why:
 * Arithmetic can produce `NaN` or infinity while still returning JavaScript's
 * `number` type; those values cannot safely be emitted as dimensions or loop
 * parameters.
 */
export function evalNum(expr: Expr, ctx: EvalCtx): number {
  const val = evalExpr(expr, ctx);
  if (typeof val !== 'number') {
    addError(ctx, `Expected number, got ${typeof val}`, expr.span);
    return 0;
  }
  if (!Number.isFinite(val)) {
    addError(ctx, 'Expected a finite number, got number', expr.span);
    return 0;
  }
  return val;
}

/**
 * Evaluates str with the current evaluation context.
 */
export function evalStr(expr: Expr, ctx: EvalCtx): string {
  const value = evalExpr(expr, ctx);
  return isFaceRefValue(value) ? value.label : String(value);
}

/**
 * Evaluates font with the current evaluation context.
 */
export function evalFont(expr: Expr | undefined, ctx: EvalCtx): IRFontRef {
  if (!expr) return 'sans';
  const value = evalExpr(expr, ctx);
  if (typeof value === 'string') return value;
  if (isIRFontAssetRef(value)) return value;
  addError(
    ctx,
    `Expected font name string or imported font asset, got ${valueType(value)}`,
    expr.span,
  );
  return 'sans';
}

/**
 * Evaluates bool with the current evaluation context.
 */
export function evalBool(expr: Expr, ctx: EvalCtx): boolean {
  return Boolean(evalExpr(expr, ctx));
}
