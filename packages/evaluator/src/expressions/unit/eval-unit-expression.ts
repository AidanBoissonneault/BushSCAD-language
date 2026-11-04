import type { Expr } from '@bushscad/ir';
import type { EvalCtx } from '../../core/eval-types.js';
import { unitToMm } from '../eval-environment-values.js';
import type { EvalNumberExpression } from '../evaluation-contract.js';

/**
 * Evaluates unit expr with the current evaluation context.
 */
export function resolveUnitExpression(
  expr: Extract<Expr, { kind: 'unit' }>,
  ctx: EvalCtx,
  evaluateNumber: EvalNumberExpression,
): number {
  const val = evaluateNumber(expr.value, ctx);
  if (expr.unit === 'deg') return val;
  return (
    (val * unitToMm(expr.unit as 'mm' | 'cm' | 'm' | 'in' | 'ft')) /
    ctx.baseUnitMm
  );
}
