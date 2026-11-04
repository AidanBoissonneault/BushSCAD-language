/**
 * Evaluates radial pattern operations after resolving targets and axes.
 */
import type { IRPatternRadial, PatternRadialStmt } from '@bushscad/ir';
import { toSpan } from '../../../core/eval-context.js';
import type { EvalCtx } from '../../../core/eval-types.js';
import {
  evalNum,
  serializeFaceRef,
} from '../../../expressions/eval-expressions.js';
import { objectTargetNames } from '../../../objects/eval-object-arrays.js';

/**
 * Emits radial pattern operations for each resolved target.
 * Keeping axis serialization with this feature preserves the evaluator's
 * reference handling before the operation reaches the geometry bridge.
 */
export function evalPatternRadial(stmt: PatternRadialStmt, ctx: EvalCtx): void {
  for (const objName of objectTargetNames(stmt.target, ctx)) {
    ctx.ops.push({
      kind: 'patternRadial',
      objName,
      count: Math.round(evalNum(stmt.count, ctx)),
      aroundRef: serializeFaceRef(stmt.around, ctx),
      span: toSpan(stmt.span),
    } satisfies IRPatternRadial);
  }
}
