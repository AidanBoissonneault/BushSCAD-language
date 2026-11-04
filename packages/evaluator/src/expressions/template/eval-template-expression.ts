import type { Expr } from '@bushscad/ir';
import type { EvalCtx } from '../../core/eval-types.js';
import type { EvalExpression } from '../evaluation-contract.js';

/**
 * Evaluates the interpolated expression parts and joins them into one string.
 * This keeps template coercion out of the main expression dispatcher.
 */
export function resolveTemplateExpression(
  expr: Extract<Expr, { kind: 'template' }>,
  ctx: EvalCtx,
  evaluateExpression: EvalExpression,
): string {
  return expr.parts
    .map((part) =>
      part.kind === 'text'
        ? part.value
        : String(evaluateExpression(part.expression, ctx)),
    )
    .join('');
}
