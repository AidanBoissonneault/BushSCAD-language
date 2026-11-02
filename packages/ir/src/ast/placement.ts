/**
 * @author Aidan Boissonneault
 * @file placement.ts
 * @purpose Provides placement behavior for the ast in IR package.
 * @last-edited October 6, 2026
 */

import type { ASTSourceSpan } from './sourceSpan.js';
import type {
  Expr,
  FaceRef,
  FnCallExpr,
  PosRef,
  RepeatableSpatialRef,
} from './expressions.js';

/** Component placement node used inside component and part bodies. */
export type PlaceStatement = {
  kind: 'place';
  component: string;
  nameSpan?: ASTSourceSpan;
  args: Expr[];
  namedArgs: { name: string; value: Expr }[];
  target: RepeatableSpatialRef | null;
  sourceAnchor: RepeatableSpatialRef | null;
  rotate: PlacementRotation | null;
  as: string | null;
  span: ASTSourceSpan;
};

/**
 * Placement rotation is tagged by kind: 'default' carries angle and 'axes' carries x, y, z.
 */
export type PlacementRotation =
  | {
      kind: 'default';
      angle: Expr;
      span: ASTSourceSpan;
    }
  | {
      kind: 'axes';
      x: Expr | null;
      y: Expr | null;
      z: Expr | null;
      span: ASTSourceSpan;
    };

/**
 * Rotate axis ref accepts 'x', 'y', 'z', and FaceRef.
 */
export type RotateAxisRef = 'x' | 'y' | 'z' | FaceRef;

/**
 * Rotate statement, including operation kind, target, angle, around, and span.
 */
export type RotateStatement = {
  kind: 'rotate';
  target: string;
  angle: Expr;
  around: RotateAxisRef;
  span: ASTSourceSpan;
};

/**
 * Call statement, including operation kind, call, and span.
 */
export type CallStatement = {
  kind: 'callStmt';
  call: FnCallExpr;
  span: ASTSourceSpan;
};

/**
 * Anchor decl, including operation kind, name, point, and span.
 */
export type AnchorDecl = {
  kind: 'anchor';
  name: string;
  point: FaceRef | PosRef;
  span: ASTSourceSpan;
};

/**
 * Plane decl, including operation kind, name, offset, from, and span.
 */
export type PlaneDecl = {
  kind: 'plane';
  name: string;
  offset: Expr;
  from: FaceRef | PosRef;
  span: ASTSourceSpan;
};

/**
 * Target for metadata is tagged by kind: 'part' and 'object' carries name.
 */
export type MetadataTarget =
  | { kind: 'part' }
  | { kind: 'object'; name: string };

/**
 * Metadata assignment, including operation kind, target, property, display value, and span.
 */
export type MetadataAssignment = {
  kind: 'metadata';
  target: MetadataTarget;
  property: 'color' | 'material';
  value: Expr;
  span: ASTSourceSpan;
};

/**
 * Pattern linear stmt, including operation kind, target, count x, count y, and spacing x.
 */
export type PatternLinearStmt = {
  kind: 'patternLinear';
  target: string;
  countX: Expr;
  countY: Expr | null;
  spacingX: Expr;
  spacingY: Expr | null;
  span: ASTSourceSpan;
};

/**
 * Pattern radial stmt, including operation kind, target, count, around, and span.
 */
export type PatternRadialStmt = {
  kind: 'patternRadial';
  target: string;
  count: Expr;
  around: FaceRef;
  span: ASTSourceSpan;
};

/**
 * Mirror plane is tagged by kind: 'world' carries axis, 'named' carries name, and 'faceRef'
 * carries ref.
 */
export type MirrorPlane =
  | { kind: 'world'; axis: 'X' | 'Y' | 'Z' }
  | { kind: 'named'; name: string }
  | { kind: 'faceRef'; ref: FaceRef };

/**
 * Mirror stmt, including operation kind, target, across, and span.
 */
export type MirrorStmt = {
  kind: 'mirror';
  target: string;
  across: MirrorPlane;
  span: ASTSourceSpan;
};

/**
 * Transform op is tagged by kind: 'translate' carries x, y, z, 'rotate' carries angle, around,
 * and 'scale' carries factor.
 */
export type TransformOp =
  | { kind: 'translate'; x: Expr | null; y: Expr | null; z: Expr | null }
  | { kind: 'rotate'; angle: Expr; around: RotateAxisRef }
  | { kind: 'scale'; factor: Expr };

/**
 * Transform stmt, including operation kind, target, operation, and span.
 */
export type TransformStmt = {
  kind: 'transform';
  target: string;
  operation: TransformOp;
  span: ASTSourceSpan;
};
