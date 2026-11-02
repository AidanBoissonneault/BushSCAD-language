/**
 * @author Aidan Boissonneault
 * @file eval-auto-expression.ts
 * @purpose Evaluates auto expression for the expressions in evaluator package.
 * @last-edited October 6, 2026
 */

import type { AutoExpr } from '@bushscad/ir';
import type { EvalCtx, EvalValue } from '../core/eval-types.js';
import { addError } from '../core/eval-context.js';

/**
 * Evaluates the `auto` placeholder in loop or parent-face contexts.
 * `auto` is the only expression whose value is provided by ambient layout
 * state, so keeping it isolated avoids spreading that context logic through
 * regular expression evaluation.
 */
export function evalAutoExpr(expr: AutoExpr, ctx: EvalCtx): EvalValue {
  if (ctx.autoGroups && ctx.autoValues) {
    const g = ctx.autoGroups.get(expr);
    if (g !== undefined) {
      const v = ctx.autoValues[g];
      if (v !== undefined) return v;
    }
  }
  const axis = ctx.autoAxis ?? 'x';
  if (ctx.autoContext) {
    const v = ctx.autoContext[axis] ?? ctx.autoContext.x ?? ctx.autoContext.y;
    if (v !== undefined) return v;
  }
  addError(
    ctx,
    `'auto' requires a 'within' loop or a parent-face context`,
    expr.span,
  );
  return 0;
}
