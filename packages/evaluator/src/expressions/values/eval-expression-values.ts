import type { Expr, IRFontRef } from '@bushscad/ir';
import type { EvalCtx } from '../../core/eval-types.js';
import {
  isFaceRefValue,
  isIRFontAssetRef,
  valueType,
} from '../../core/eval-types.js';
import { addError } from '../../core/eval-context.js';
import type { EvalExpression } from '../evaluation-contract.js';

/**
 * Evaluates a finite number for a numeric-only language input.
 *
 * Why:
 * Arithmetic can produce `NaN` or infinity while still returning JavaScript's
 * `number` type; those values cannot safely be emitted as dimensions or loop
 * parameters.
 */
export function evaluateNumberExpression(
  expr: Expr,
  ctx: EvalCtx,
  evaluateExpression: EvalExpression,
): number {
  const val = evaluateExpression(expr, ctx);
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
export function evaluateStringExpression(
  expr: Expr,
  ctx: EvalCtx,
  evaluateExpression: EvalExpression,
): string {
  const value = evaluateExpression(expr, ctx);
  return isFaceRefValue(value) ? value.label : String(value);
}

/**
 * Evaluates font with the current evaluation context.
 */
export function evaluateFontExpression(
  expr: Expr | undefined,
  ctx: EvalCtx,
  evaluateExpression: EvalExpression,
): IRFontRef {
  if (!expr) return 'sans';
  const value = evaluateExpression(expr, ctx);
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
export function evaluateBooleanExpression(
  expr: Expr,
  ctx: EvalCtx,
  evaluateExpression: EvalExpression,
): boolean {
  return Boolean(evaluateExpression(expr, ctx));
}
