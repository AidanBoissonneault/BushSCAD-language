import type { ASTSourceSpan } from '../../sourceSpan.js';
import type { Expr } from '../../expressions.js';
import type { SurfaceInput } from '../inputs.js';

/**
 * Thicken op, including operation kind, surface, thickness, and span.
 */
export type ThickenOp = {
  kind: 'thicken';
  surface: SurfaceInput;
  thickness: Expr;
  span: ASTSourceSpan;
};
