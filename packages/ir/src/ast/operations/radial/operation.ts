import type { ASTSourceSpan } from '../../sourceSpan.js';
import type { Expr, RepeatableSpatialRef } from '../../expressions.js';
import type { SketchInput } from '../inputs.js';
import type { RevolveAxisRef } from '../revolve/operation.js';

/**
 * Accepted values for radial curve kind are 'natural', 'linear', 'ease', 'ease-in', 'ease-out',
 * 'ease-in-out', 'step-start', and 'step-end'.
 */
export type RadialCurveKind =
  | 'natural'
  | 'linear'
  | 'ease'
  | 'ease-in'
  | 'ease-out'
  | 'ease-in-out'
  | 'step-start'
  | 'step-end';

/**
 * Radial curve accepts { kind: RadialCurveKind; span: ASTSourceSpan } and { kind:
 * 'cubic-bezier'; x1: Expr; y1: Expr; x2: Ex.
 */
export type RadialCurve =
  | { kind: RadialCurveKind; span: ASTSourceSpan }
  | {
      kind: 'cubic-bezier';
      x1: Expr;
      y1: Expr;
      x2: Expr;
      y2: Expr;
      span: ASTSourceSpan;
    };

/**
 * Accepted values for radial direction are 'ccw' and 'cw'.
 */
export type RadialDirection = 'ccw' | 'cw';

/**
 * Radial extent is tagged by kind: 'angle-length' carries angle, length, 'between' carries a, b,
 * and 'placement-bridge' carries from, to, along.
 */
export type RadialExtent =
  | { kind: 'angle-length'; angle: Expr; length: Expr }
  | { kind: 'between'; a: RepeatableSpatialRef; b: RepeatableSpatialRef }
  | {
      kind: 'placement-bridge';
      from: RepeatableSpatialRef;
      to: RepeatableSpatialRef;
      along: string | null;
    };

/**
 * Radial sections is tagged by kind: 'auto' and 'expr' carries display value.
 */
export type RadialSections = { kind: 'auto' } | { kind: 'expr'; value: Expr };

/** Arguments shared by radial extrude and radial cut operation contracts. */
type RadialOperationFields = {
  sketch: SketchInput;
  axis: RevolveAxisRef | null;
  extent: RadialExtent;
  curve: RadialCurve;
  direction: RadialDirection;
  start: Expr | null;
  twist: Expr | null;
  taper: Expr | null;
  radius: Expr | null;
  sections: RadialSections;
  from: RepeatableSpatialRef | null;
  span: ASTSourceSpan;
};

/** Radial extrude operation contract. */
export type RadialExtrudeOp = RadialOperationFields & {
  kind: 'radial_extrude';
};

/**
 * Radial cut op, including operation kind, sketch, axis, extent, and curve.
 */
export type RadialCutOp = RadialOperationFields & {
  kind: 'radial_cut';
};
