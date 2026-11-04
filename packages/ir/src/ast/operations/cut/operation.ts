import type { ASTSourceSpan } from '../../sourceSpan.js';
import type { Expr, RepeatableSpatialRef } from '../../expressions.js';
import type { SketchInput, ThroughTarget } from '../inputs.js';

/**
 * Cut op, including operation kind, sketch, through, depth, and from.
 */
export type CutOp = {
  kind: 'cut';
  sketch: SketchInput;
  through: ThroughTarget;
  depth: Expr | null;
  from: RepeatableSpatialRef | null;
  wrap: boolean;
  span: ASTSourceSpan;
};
