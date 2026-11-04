import type { Expr } from '@bushscad/ir';
import type { EvalCtx, EvalValue } from '../../core/eval-types.js';
import { addError } from '../../core/eval-context.js';

/**
 * Evaluates this expr with the current evaluation context.
 */
export function resolveThisExpression(
  expr: Extract<Expr, { kind: 'this' }>,
  ctx: EvalCtx,
): EvalValue {
  if (!ctx.thisContext) {
    addError(
      ctx,
      `'this.${expr.property}' requires a parent sketching context`,
      expr.span,
    );
    return 0;
  }
  switch (expr.property) {
    case 'width':
      return ctx.thisContext.width;
    case 'height':
      return ctx.thisContext.height;
    case 'area':
      return ctx.thisContext.area;
    case 'center':
      return ctx.thisContext.center;
    case 'normal':
      return ctx.thisContext.normal;
  }
}
