/**
 * Emits transform operations for resolved object targets.
 */
import type {
  IRRotationAxis,
  IRTransform,
  IRTransformOp,
  TransformStmt,
} from '@bushscad/ir';
import { toSpan } from '../../core/eval-context.js';
import type { EvalCtx } from '../../core/eval-types.js';
import { evalNum, evalPlacement } from '../../expressions/eval-expressions.js';
import { objectTargetNames } from '../../objects/eval-object-arrays.js';
/**
 * Emits transform operations for resolved object targets.
 */
export function evalTransform(stmt: TransformStmt, ctx: EvalCtx): void {
  const operation = evalTransformOp(stmt.operation, ctx);
  for (const objName of objectTargetNames(stmt.target, ctx)) {
    ctx.ops.push({
      kind: 'transform',
      objName,
      operation,
      span: toSpan(stmt.span),
    } satisfies IRTransform);
  }
}

/**
 * Converts a parsed transform operation into the evaluator IR operation.
 */
function evalTransformOp(
  op: TransformStmt['operation'],
  ctx: EvalCtx,
): IRTransformOp {
  if (op.kind === 'translate') {
    return {
      kind: 'translate',
      x: op.x ? evalNum(op.x, ctx) * ctx.baseUnitMm : 0,
      y: op.y ? evalNum(op.y, ctx) * ctx.baseUnitMm : 0,
      z: op.z ? evalNum(op.z, ctx) * ctx.baseUnitMm : 0,
    };
  }
  if (op.kind === 'rotate') {
    const around: IRRotationAxis =
      typeof op.around === 'string' ? op.around : evalPlacement(op.around, ctx);
    return {
      kind: 'rotate',
      angleDeg: evalNum(op.angle, ctx),
      around,
    };
  }
  return {
    kind: 'scale',
    factor: evalNum(op.factor, ctx),
  };
}
