import type { ASTSourceSpan } from '../../sourceSpan.js';
import type { Expr, RepeatableSpatialRef } from '../../expressions.js';
import type { SketchInput } from '../inputs.js';

/**
 * Extrude op, including operation kind, sketch, depth, from, and symmetric.
 */
export type ExtrudeOp = {
  kind: 'extrude';
  sketch: SketchInput;
  depth: Expr;
  from: RepeatableSpatialRef | null;
  symmetric: boolean;
  wrap: boolean;
  span: ASTSourceSpan;
};
