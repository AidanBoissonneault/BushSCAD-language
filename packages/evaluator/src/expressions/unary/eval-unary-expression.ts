import type { Expr } from '@bushscad/ir';
import type { EvalCtx, EvalValue } from '../../core/eval-types.js';
import { addError } from '../../core/eval-context.js';
import type { EvalExpression } from '../evaluation-contract.js';

/**
 * Evaluates a unary expression and reports invalid numeric negation.
 */
export function resolveUnaryExpression(
  expr: Extract<Expr, { kind: 'unary' }>,
  ctx: EvalCtx,
  evaluateExpression: EvalExpression,
): EvalValue {
  const value = evaluateExpression(expr.operand, ctx);
  if (expr.op === '!') return !value;
  if (typeof value !== 'number') {
    addError(ctx, `Unary '-' requires a numeric operand`, expr.span);
    return 0;
  }
  return -value;
}
