/**
 * @author Aidan Boissonneault
 * @file sketchAnnotations.ts
 * @purpose Provides sketch annotations behavior for the ast in IR package.
 * @last-edited October 6, 2026
 */

import type { Expr } from './expressions.js';
import type { ASTSourceSpan } from './sourceSpan.js';

/** Constraint kinds accepted by profile and path sketch annotations. */
export type ConstraintKind =
  | 'horizontal'
  | 'vertical'
  | 'parallel'
  | 'perpendicular'
  | 'tangent'
  | 'equal'
  | 'symmetric'
  | 'fixed'
  | 'coincident'
  | 'midpoint'
  | 'length'
  | 'distance'
  | 'angle'
  | 'radius'
  | 'diameter';

/** Cartesian component used by point-to-point distance dimensions. */
export type SketchDimensionAxis = 'x' | 'y';

/** Primitive scalar that can be supplied by a compact dimension assignment. */
export type CompactSketchParameter = 'width' | 'height' | 'diameter' | 'radius';

/**
 * Driving dimension written after a compact sketch declaration.
 * Compact primitives imply their topology, so their editable dimensions live
 * beside the declaration instead of expanding the primitive into a path.
 */
export type CompactSketchDimensionDecl = {
  kind: 'compactDimension';
  name?: string;
  dimension: Extract<
    ConstraintKind,
    'length' | 'distance' | 'radius' | 'diameter'
  >;
  target: string;
  property: string;
  ref?: string;
  axis?: SketchDimensionAxis;
  value: Expr;
  /** Optional distance from the automatically selected exterior label side. */
  offset?: Expr;
  /** Primitive field supplied by `_`, assigned during resolution. */
  parameter?: CompactSketchParameter;
  span: ASTSourceSpan;
};

/** A geometric or dimensional constraint on a path segment or endpoint. */
export type ConstraintDecl = {
  kind: 'constraint';
  /** Optional sketch-local scalar name for this dimension measurement. */
  name?: string;
  constraint: ConstraintKind;
  /** Primary target: segment name or point name. */
  target: string;
  /** Property name for dimensional targets like `segment.length`. */
  property?: string;
  /** Secondary target for binary constraints, including point-pair horizontal/vertical alignment. */
  ref?: string;
  /** Optional Cartesian component for horizontal/vertical point distances. */
  axis?: SketchDimensionAxis;
  /** Dimensional value expression. */
  value?: Expr;
  /** Label placement for persistent driving dimensions. */
  label?: [Expr, Expr];
  span: ASTSourceSpan;
};

/** A display-only sketch dimension that is not sent to the constraint solver. */
export type SketchDimensionDecl = {
  kind: 'dimension';
  /** Optional sketch-local scalar name for this measured value. */
  name?: string;
  dimension: Extract<
    ConstraintKind,
    'length' | 'distance' | 'angle' | 'radius' | 'diameter'
  >;
  target: string;
  property: string;
  ref?: string;
  /** Optional Cartesian component for horizontal/vertical point distances. */
  axis?: SketchDimensionAxis;
  label: [Expr, Expr];
  span: ASTSourceSpan;
};
