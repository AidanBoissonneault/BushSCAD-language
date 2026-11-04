import type { ASTSourceSpan } from '../sourceSpan.js';
import type { RepeatableSpatialRef } from '../expressions.js';
import type { SolidPrimitiveOp } from '../solidPrimitives.js';
import type { ExtrudeOp } from './extrude/operation.js';
import type { CutOp } from './cut/operation.js';
import type { RevolveOp } from './revolve/operation.js';
import type { RadialExtrudeOp, RadialCutOp } from './radial/operation.js';
import type { LoftOp } from './loft/operation.js';
import type { HoleOp } from './hole/operation.js';
import type { HeatsetInsertOp } from './heatset-insert/operation.js';
import type { SweepOp, SweepCutOp } from './sweep/operation.js';
import type { ThickenOp } from './thicken/operation.js';

/** Solid creation and boolean operation parsed from an obj declaration. */
export type ObjectOperation =
  | ExtrudeOp
  | CutOp
  | SolidCutOp
  | RevolveOp
  | RadialExtrudeOp
  | RadialCutOp
  | LoftOp
  | HoleOp
  | HeatsetInsertOp
  | SweepOp
  | SweepCutOp
  | ThickenOp
  | SolidPrimitiveOp;

/**
 * Input for object is tagged by kind: 'namedObject' carries name and 'inlineObject' carries
 * operation.
 */
export type ObjectInput =
  | { kind: 'namedObject'; name: string; span: ASTSourceSpan }
  | { kind: 'inlineObject'; operation: ObjectOperation; span: ASTSourceSpan };

/**
 * Solid cut tool is tagged by kind: 'object' carries object and 'operation' carries operation.
 */
export type SolidCutTool =
  | { kind: 'object'; object: ObjectInput; span: ASTSourceSpan }
  | {
      kind: 'operation';
      operation: ExtrudeOp | RevolveOp | LoftOp | SweepOp | ThickenOp;
      span: ASTSourceSpan;
    };

/**
 * Solid cut op, including operation kind, tool, from, and span.
 */
export type SolidCutOp = {
  kind: 'solid_cut';
  tool: SolidCutTool;
  from: RepeatableSpatialRef;
  span: ASTSourceSpan;
};
