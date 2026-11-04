import type { ASTSourceSpan } from '../../sourceSpan.js';
import type { Expr, RepeatableSpatialRef } from '../../expressions.js';

/**
 * Heatset insert op, including operation kind, size, depth, from, and span.
 */
export type HeatsetInsertOp = {
  kind: 'heatset_insert';
  size: string;
  depth: Expr | null;
  from: RepeatableSpatialRef | null;
  span: ASTSourceSpan;
};
