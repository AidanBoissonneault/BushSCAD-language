import type { ASTSourceSpan } from '../../sourceSpan.js';
import type { Expr, RepeatableSpatialRef } from '../../expressions.js';
import type { HardwareSpecRef } from '../hardware/spec.js';
import type { ThroughTarget } from '../inputs.js';

/**
 * Hole op, including operation kind, spec, through, depth, and from.
 */
export type HoleOp = {
  kind: 'hole';
  spec: HardwareSpecRef;
  through: ThroughTarget;
  depth: Expr | null;
  from: RepeatableSpatialRef | null;
  span: ASTSourceSpan;
};
