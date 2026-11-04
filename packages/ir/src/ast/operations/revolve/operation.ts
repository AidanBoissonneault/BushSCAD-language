import type { ASTSourceSpan } from '../../sourceSpan.js';
import type { Expr, FaceRef } from '../../expressions.js';
import type { SketchInput } from '../inputs.js';

/**
 * Revolve axis ref accepts 'x', 'y', 'z', and FaceRef.
 */
export type RevolveAxisRef = 'x' | 'y' | 'z' | FaceRef;

/**
 * Revolve op, including operation kind, sketch, angle, around, and radius.
 */
export type RevolveOp = {
  kind: 'revolve';
  sketch: SketchInput;
  angle: Expr;
  around: RevolveAxisRef;
  radius?: Expr;
  span: ASTSourceSpan;
};
