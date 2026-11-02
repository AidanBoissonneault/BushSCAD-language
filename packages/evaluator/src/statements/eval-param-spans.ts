/**
 * @author Aidan Boissonneault
 * @file eval-param-spans.ts
 * @purpose Evaluates param spans for the statements in evaluator package.
 * @last-edited October 6, 2026
 */

import type { Expr, IRParamSpans } from '@bushscad/ir';
import { toSpan } from '../core/eval-context.js';

/**
 * Builds the `paramSpans` map for an IR op. Only direct numeric literals and the
 * `auto` keyword get an entry — args derived from variables or expressions are
 * deliberately omitted so the timeline only offers safe in-place edits. Returns
 * undefined when empty.
 */
export function paramSpansFrom(
  entries: Record<string, Expr | null | undefined>,
): IRParamSpans | undefined {
  const out: IRParamSpans = {};
  for (const [name, expr] of Object.entries(entries)) {
    if (expr && expr.kind === 'number') {
      out[name] = { span: toSpan(expr.span), literal: String(expr.value) };
    } else if (expr && expr.kind === 'auto') {
      out[name] = { span: toSpan(expr.span), literal: 'auto' };
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}
