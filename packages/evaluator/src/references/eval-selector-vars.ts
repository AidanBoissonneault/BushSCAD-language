/**
 * @author Aidan Boissonneault
 * @file eval-selector-vars.ts
 * @purpose Evaluates selector vars for the references in evaluator package.
 * @last-edited October 6, 2026
 */

import type { Expr } from '@bushscad/ir';
import type { EvalCtx, EvalValue } from '../core/eval-types.js';
import { evalExpr, FACE_WORDS } from '../expressions/eval-expressions.js';

/**
 * Evaluates variables that are intended to feed reference selector expansion.
 * Selector arrays are source-level names, not numeric variables. This keeps
 * `var sides = [top, bottom]; @body.sides` valid without making ordinary
 * undefined identifiers evaluate successfully everywhere.
 */
export function evalVarValue(expr: Expr, ctx: EvalCtx): EvalValue {
  const selectorValue = selectorValueFromExpr(expr);
  return selectorValue ?? evalExpr(expr, ctx);
}

/**
 * Handles selector value from expr in the references flow.
 */
function selectorValueFromExpr(expr: Expr): string | string[] | null {
  if (expr.kind === 'identifier' && FACE_WORDS.has(expr.name)) {
    return expr.name;
  }
  if (expr.kind !== 'list') return null;

  const values: string[] = [];
  for (const item of expr.items) {
    if (item.kind === 'identifier' && FACE_WORDS.has(item.name)) {
      values.push(item.name);
      continue;
    }
    if (item.kind === 'string') {
      values.push(item.value);
      continue;
    }
    return null;
  }
  return values.length > 0 ? values : null;
}
