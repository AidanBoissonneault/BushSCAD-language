import type { ASTSourceSpan, IRPrimitive, SketchPrimitive } from '@bushscad/ir';
import type { EvalCtx } from '../../../core/eval-types.js';
import { addError } from '../../../core/eval-context.js';
import { profileClosed } from '../../eval-profile-validation.js';
import type { PrimitiveEvaluator } from '../types.js';

/** Evaluates both boolean operands and validates that their profiles are closed. */
export function evalSketchBooleanPrimitive(
  primitive: Extract<SketchPrimitive, { kind: 'sketchBoolean' }>,
  ctx: EvalCtx,
  evalPrimitive: PrimitiveEvaluator,
): IRPrimitive | null {
  const left = evalPrimitive(primitive.left, ctx);
  const right = evalPrimitive(primitive.right, ctx);
  if (!left || !right) return null;
  validateBooleanOperand(left, primitive.left.span, ctx);
  validateBooleanOperand(right, primitive.right.span, ctx);
  return { kind: 'sketchBoolean', op: primitive.op, left, right };
}

/** Reports open-profile inputs to a sketch boolean operation. */
function validateBooleanOperand(
  primitive: IRPrimitive,
  span: ASTSourceSpan,
  ctx: EvalCtx,
): void {
  if (containsOpenProfile(primitive)) {
    addError(
      ctx,
      'Sketch boolean operands must be closed filled profiles',
      span,
    );
  }
}

/** Checks nested primitive forms for profile geometry that is still open. */
function containsOpenProfile(primitive: IRPrimitive): boolean {
  if (primitive.kind === 'profile') return !profileClosed(primitive);
  if (primitive.kind === 'sketchAt')
    return containsOpenProfile(primitive.primitive);
  if (primitive.kind === 'sketchAlias')
    return containsOpenProfile(primitive.primitive);
  if (primitive.kind === 'sketchBoolean') {
    return (
      containsOpenProfile(primitive.left) || containsOpenProfile(primitive.right)
    );
  }
  if (primitive.kind === 'sketchRef') return false;
  return false;
}
