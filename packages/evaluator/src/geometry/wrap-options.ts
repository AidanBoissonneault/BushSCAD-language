/**
 * @author Aidan Boissonneault
 * @file wrap-options.ts
 * @purpose Provides wrap options behavior for the geometry in evaluator package.
 * @last-edited October 6, 2026
 */

import type { WrapSketchPrimitive } from '@bushscad/ir';
import type { EvaluatedWrapOptions } from '@bushscad/ir';
import { GEOM_EPS, clamp } from '@bushscad/ir';
import { addError } from '../core/eval-context.js';
import type { EvalCtx } from '../core/eval-types.js';
import { evalNum } from '../expressions/eval-expressions.js';

/**
 * Evaluates supported wrap keyword options once and rejects misspellings.
 * The parser accepts keyword-shaped options generically, but the evaluator owns
 * their numeric meaning and can report unknown controls with source spans.
 */
export function evalWrapOptions(
  prim: WrapSketchPrimitive,
  ctx: EvalCtx,
): EvaluatedWrapOptions {
  const options: EvaluatedWrapOptions = {};
  for (const option of prim.options) {
    const value = evalNum(option.value, ctx);
    if (option.name === 'rounded') options.rounded = positiveOption(value);
    else if (option.name === 'tension') options.tension = clamp(value, 0, 0.45);
    else if (option.name === 'tolerance')
      options.tolerance = Math.max(value, GEOM_EPS);
    else
      addError(
        ctx,
        `Unknown wrap() option '${option.name}'. Expected rounded, tension, or tolerance.`,
        option.value.span,
      );
  }
  return options;
}

/**
 * Handles positive option in the geometry flow.
 */
function positiveOption(value: number): number | undefined {
  return value > GEOM_EPS ? value : undefined;
}
