/**
 * Emits rotate operations for placed objects or object targets.
 */
import type { IRRotate, RotateStatement } from '@bushscad/ir';
import { addError, toSpan } from '../../core/eval-context.js';
import type { EvalCtx } from '../../core/eval-types.js';
import { evalNum, evalPlacement } from '../../expressions/eval-expressions.js';
import { objectTargetNames } from '../../objects/eval-object-arrays.js';
/**
 * Emits rotate operations for placed objects or object targets.
 */
export function evalRotate(stmt: RotateStatement, ctx: EvalCtx): void {
  const placedTarget = ctx.placedInstanceRoots.get(stmt.target);
  if (
    !placedTarget &&
    (ctx.components.has(stmt.target) || ctx.functions.has(stmt.target))
  ) {
    addError(
      ctx,
      `No placed instance of '${stmt.target}' is available for rotate`,
      stmt.span,
    );
    return;
  }
  const around =
    typeof stmt.around === 'string'
      ? stmt.around
      : evalPlacement(stmt.around, ctx);
  for (const target of placedTarget
    ? [placedTarget]
    : objectTargetNames(stmt.target, ctx)) {
    ctx.ops.push({
      kind: 'rotate',
      target,
      angleDeg: evalNum(stmt.angle, ctx),
      around,
      span: toSpan(stmt.span),
    } satisfies IRRotate);
  }
}
