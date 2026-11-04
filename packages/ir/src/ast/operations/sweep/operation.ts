import type { ASTSourceSpan } from '../../sourceSpan.js';
import type { Expr, RepeatableSpatialRef } from '../../expressions.js';
import type { SketchInput, PathInput, ThroughTarget } from '../inputs.js';

/**
 * Accepted values for sweep orientation are 'default', 'fixed', and 'binormal'.
 */
export type SweepOrientation = 'default' | 'fixed' | 'binormal';

/**
 * Sweep op, including operation kind, sketch, path, orientation, and span.
 */
export type SweepOp = {
  kind: 'sweep';
  sketch: SketchInput;
  path: PathInput;
  orientation: SweepOrientation;
  span: ASTSourceSpan;
};

/**
 * Sweep cut op, including operation kind, sketch, path, through, and depth.
 */
export type SweepCutOp = {
  kind: 'sweep_cut';
  sketch: SketchInput;
  path: PathInput;
  through: ThroughTarget;
  depth: Expr | null;
  from: RepeatableSpatialRef | null;
  orientation: SweepOrientation;
  span: ASTSourceSpan;
};
