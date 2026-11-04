import type { ASTSourceSpan } from '../../sourceSpan.js';
import type { Expr } from '../../expressions.js';
import type { SketchInput } from '../inputs.js';

/**
 * Loft op, including operation kind, sketches, height, guide, and guide workplane.
 */
export type LoftOp = {
  kind: 'loft';
  sketches: SketchInput[];
  height: Expr;
  guide: SketchInput | null;
  guideWorkplane?: 'XY' | 'XZ' | 'YZ';
  span: ASTSourceSpan;
};
