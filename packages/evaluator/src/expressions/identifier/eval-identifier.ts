import type { Expr } from '@bushscad/ir';
import type { EvalCtx, EvalValue } from '../../core/eval-types.js';
import { addError } from '../../core/eval-context.js';

/**
 * Evaluates identifier with the current evaluation context.
 */
export function resolveIdentifier(
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
