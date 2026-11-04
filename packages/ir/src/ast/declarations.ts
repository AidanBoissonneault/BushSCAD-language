/**
 * @author Aidan Boissonneault
 * @file declarations.ts
 * @purpose Provides declarations behavior for the ast in IR package.
 * @last-edited October 6, 2026
 */

import type { ASTSourceSpan } from './sourceSpan.js';
import type { Literal, Expr, FnCallExpr } from './expressions.js';
import type { DrawingDecl } from './drawing.js';
import type { DetailStatement } from './details.js';
import type { SurfaceDecl } from './surface.js';
import type { SketchPlacement, SketchPrimitive } from './sketchPrimitives.js';
import type { ObjectOperation, PathPrimitive } from './operations.js';
import type {
  AnchorDecl,
  MirrorStmt,
  PatternLinearStmt,
  PatternRadialStmt,
  PlaceStatement,
  RotateStatement,
  TransformStmt,
} from './placement.js';
import type { ComponentBody } from './control-flow.js';
export type {
  ComponentBody,
  ComponentStatement,
  EnumerateIter,
  ForStatement,
  GridIter,
  IfStatement,
  ListIter,
  RadialIter,
  RangeIter,
  ReturnStatement,
  WithinClause,
  WithinDim,
} from './control-flow.js';

/** Root AST node produced by the parser. */
export type Program = {
  kind: 'program';
  baseUnit: 'mm' | 'cm' | 'm' | 'in' | 'ft' | null;
  workplane: 'XY' | 'XZ' | 'YZ' | null;
  statements: TopLevelStatement[];
  span: ASTSourceSpan;
};

/** Top-level declarations accepted by a BushSCAD source file. */
export type TopLevelStatement =
  | VarDecl
  | EnvDecl
  | FontImportDecl
  | ShapeImportDecl
  | HealDecl
  | DefeatureDecl
  | UseDecl
  | SketchDecl
  | SurfaceDecl
  | PathDecl
  | ObjDecl
  | ObjFromCallDecl
  | AnchorDecl
  | RotateStatement
  | DetailStatement
  | PlaceStatement
  | PatternLinearStmt
  | PatternRadialStmt
  | MirrorStmt
  | TransformStmt
  | PartDecl
  | FnDecl
  | RefPartDecl
  | RefObjDecl
  | ImportDecl
  | ExportDecl
  | AssertStatement
  | FitDecl
  | DrawingDecl
  | JointDecl;

/**
 * Var decl, including operation kind, name, display value, and span.
 */
export type VarDecl = {
  kind: 'var';
  name: string;
  value: Expr;
  span: ASTSourceSpan;
};

/**
 * Env decl, including operation kind, name, fallback, and span.
 */
export type EnvDecl = {
  kind: 'env';
  name: string;
  fallback: Literal;
  span: ASTSourceSpan;
};

/**
 * Font import decl, including operation kind, name, path, resolved path, and fs path.
 */
export type FontImportDecl = {
  kind: 'fontImport';
  name: string;
  path: string;
  resolvedPath?: string;
  fsPath?: string;
  span: ASTSourceSpan;
};

/**
 * Shape import decl, including operation kind, name, name span, path, and resolved path.
 */
export type ShapeImportDecl = {
  kind: 'shapeImport';
  name: string;
  nameSpan?: ASTSourceSpan;
  path: string;
  resolvedPath?: string;
  fsPath?: string;
  span: ASTSourceSpan;
};

/**
 * Heal decl, including operation kind, target, tolerance, and span.
 */
export type HealDecl = {
  kind: 'heal';
  target?: string;
  tolerance: Expr;
  span: ASTSourceSpan;
};

/**
 * Defeature decl, including operation kind, target, feature type, threshold, and span.
 */
export type DefeatureDecl = {
  kind: 'defeature';
  target?: string;
  featureType: 'holes' | 'pockets';
  threshold: Expr;
  span: ASTSourceSpan;
};

/**
 * Sketch decl, including operation kind, name, name span, primitive, and placement.
 */
export type SketchDecl = {
  kind: 'sketch';
  name: string;
  nameSpan?: ASTSourceSpan;
  primitive: SketchPrimitive;
  placement?: SketchPlacement;
  span: ASTSourceSpan;
};

/**
 * Use decl, including operation kind, library, and span.
 */
export type UseDecl = {
  kind: 'use';
  library: string;
  span: ASTSourceSpan;
};

/**
 * Path decl, including operation kind, name, primitive, and span.
 */
export type PathDecl = {
  kind: 'path';
  name: string;
  primitive: PathPrimitive;
  span: ASTSourceSpan;
};

/**
 * Obj decl, including operation kind, name, name span, operation, and anchors.
 */
export type ObjDecl = {
  kind: 'obj';
  name: string;
  nameSpan?: ASTSourceSpan;
  operation: ObjectOperation;
  anchors: AnchorDecl[];
  span: ASTSourceSpan;
};

/**
 * Obj from call decl, including operation kind, name, name span, call, and span.
 */
export type ObjFromCallDecl = {
  kind: 'objCall';
  name: string;
  nameSpan?: ASTSourceSpan;
  call: FnCallExpr;
  span: ASTSourceSpan;
};

/**
 * Ref part decl, including operation kind, name, name span, extends, and body.
 */
export type RefPartDecl = {
  kind: 'refPart';
  name: string;
  nameSpan?: ASTSourceSpan;
  extends?: string;
  body: ComponentBody;
  span: ASTSourceSpan;
};

/**
 * Ref obj decl, including operation kind, name, name span, operation, and span.
 */
export type RefObjDecl = {
  kind: 'refObj';
  name: string;
  nameSpan?: ASTSourceSpan;
  operation: ObjectOperation;
  span: ASTSourceSpan;
};

/**
 * Part decl, including operation kind, name, name span, body, and span.
 */
export type PartDecl = {
  kind: 'part';
  name: string;
  nameSpan?: ASTSourceSpan;
  body: ComponentBody;
  span: ASTSourceSpan;
};

/**
 * Fn decl, including operation kind, name, params, body, and exported.
 */
export type FnDecl = {
  kind: 'fn';
  name: string;
  params: FnParam[];
  body: ComponentBody;
  exported: boolean;
  span: ASTSourceSpan;
};

/**
 * Fn param, including name and default.
 */
export type FnParam = {
  name: string;
  default: Expr | null;
};

/**
 * Import decl, including operation kind, path, names, namespace, and resolved.
 */
export type ImportDecl = {
  kind: 'import';
  path: string;
  names: { name: string; alias: string | null }[] | null;
  namespace: string | null;
  resolved?: TopLevelStatement[];
  span: ASTSourceSpan;
};

/**
 * Export decl, including operation kind, statement, and span.
 */
export type ExportDecl = {
  kind: 'export';
  statement: TopLevelStatement;
  span: ASTSourceSpan;
};

/**
 * Assert statement, including operation kind, condition, severity, message, and span.
 */
export type AssertStatement = {
  kind: 'assert';
  condition: Expr;
  severity: 'error' | 'warning';
  message: string | null;
  span: ASTSourceSpan;
};

/**
 * Accepted values for fit kind are 'clearance', 'slip', 'press', 'interference', 'loose', and
 * 'tight'.
 */
export type FitKind =
  'clearance' | 'slip' | 'press' | 'interference' | 'loose' | 'tight';
/**
 * Accepted values for tolerance level are 'normal', 'tight', and 'loose'.
 */
export type ToleranceLevel = 'normal' | 'tight' | 'loose';

/**
 * Fit decl, including operation kind, fit kind, fit name, relation, and target name.
 */
export type FitDecl = {
  kind: 'fit';
  fitKind: FitKind;
  fitName: string;
  relation: 'through' | 'into';
  targetName: string;
  toleranceLevel: ToleranceLevel;
  span: ASTSourceSpan;
};

/**
 * Accepted values for joint type are 'fixed', 'revolute', 'slider', 'planar', and 'ball'.
 */
export type JointType = 'fixed' | 'revolute' | 'slider' | 'planar' | 'ball';

/**
 * Joint decl, including operation kind, name, side a, side b, and joint type.
 */
export type JointDecl = {
  kind: 'joint';
  name: string;
  sideA: string;
  sideB: string;
  jointType: JointType;
  limitMin?: Expr;
  limitMax?: Expr;
  defaultValue?: Expr;
  span: ASTSourceSpan;
};
