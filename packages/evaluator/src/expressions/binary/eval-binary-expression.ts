import type { Expr } from '@bushscad/ir';
import type { EvalCtx, EvalValue } from '../../core/eval-types.js';
import { addError } from '../../core/eval-context.js';
import { evalBinaryValue, isNumericBinaryOperator } from '../eval-binary.js';
import type { EvalExpression } from '../evaluation-contract.js';

/**
 * Evaluates a binary expression and records invalid numeric operands.
 */
export function resolveBinaryExpression(
  expr: Extract<Expr, { kind: 'binary' }>,
  ctx: EvalCtx,
  evaluateExpression: EvalExpression,
): EvalValue {
  const left = evaluateExpression(expr.left, ctx);
  const right = evaluateExpression(expr.right, ctx);
  if (
    isNumericBinaryOperator(expr.op) &&
    (typeof left !== 'number' || typeof right !== 'number')
  ) {
    addError(ctx, `Operator '${expr.op}' requires numeric operands`, expr.span);
    return 0;
  }
  return evalBinaryValue(expr.op, left, right, 0);
}
