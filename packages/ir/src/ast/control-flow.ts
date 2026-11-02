/**
 * @author Aidan Boissonneault
 * @file control-flow.ts
 * @purpose Provides control flow behavior for the ast in IR package.
 * @last-edited October 6, 2026
 */

import type { ASTSourceSpan } from './sourceSpan.js';
import type { Expr, FaceRef } from './expressions.js';
import type { SurfaceDecl } from './surface.js';
import type { SheetDecl } from './sheet.js';
import type { DetailStatement } from './details.js';
import type {
  AnchorDecl,
  CallStatement,
  MetadataAssignment,
  MirrorStmt,
  PatternLinearStmt,
  PatternRadialStmt,
  PlaceStatement,
  PlaneDecl,
  RotateStatement,
  TransformStmt,
} from './placement.js';
import type {
  AssertStatement,
  DefeatureDecl,
  EnvDecl,
  FitDecl,
  FnDecl,
  HealDecl,
  JointDecl,
  ObjDecl,
  ObjFromCallDecl,
  PathDecl,
  RefObjDecl,
  RefPartDecl,
  SketchDecl,
  UseDecl,
  VarDecl,
} from './declarations.js';

/** Statements and source range owned by a block body. */
export type ComponentBody = {
  statements: ComponentStatement[];
  span: ASTSourceSpan;
};

/** Statements allowed inside components, parts, functions, and return bodies. */
export type ComponentStatement =
  | VarDecl
  | EnvDecl
  | HealDecl
  | DefeatureDecl
  | UseDecl
  | SketchDecl
  | SurfaceDecl
  | PathDecl
  | ObjDecl
  | ObjFromCallDecl
  | RefPartDecl
  | RefObjDecl
  | FnDecl
  | CallStatement
  | ReturnStatement
  | ForStatement
  | IfStatement
  | PlaceStatement
  | RotateStatement
  | PatternLinearStmt
  | PatternRadialStmt
  | MirrorStmt
  | TransformStmt
  | DetailStatement
  | PlaneDecl
  | AnchorDecl
  | MetadataAssignment
  | AssertStatement
  | FitDecl
  | JointDecl
  | SheetDecl;

/**
 * Return statement, including operation kind, body, and span.
 */
export type ReturnStatement = {
  kind: 'return';
  body: ComponentBody;
  span: ASTSourceSpan;
};

/** Loop forms supported inside component bodies. */
export type ForStatement = {
  kind: 'for';
  binding: string | [string, string];
  iterator: RangeIter | GridIter | RadialIter | ListIter | EnumerateIter;
  where: Expr | null;
  within: WithinClause | null;
  body: ComponentBody;
  span: ASTSourceSpan;
};

/** Optional source distribution bounds attached to a loop. */
export type WithinClause = {
  dims: WithinDim[];
  span: ASTSourceSpan;
};

/**
 * Within dim is tagged by kind: 'faceDim' carries ref, dim and 'expr' carries expr.
 */
export type WithinDim =
  | {
      kind: 'faceDim';
      ref: FaceRef;
      dim: 'width' | 'height';
      span: ASTSourceSpan;
    }
  | { kind: 'expr'; expr: Expr; span: ASTSourceSpan };

/**
 * Range iter, including operation kind, start, end, and step.
 */
export type RangeIter = { kind: 'range'; start?: Expr; end: Expr; step?: Expr };

/**
 * Grid iter, including operation kind, cols, rows, spacing, and spacing x.
 */
export type GridIter = {
  kind: 'grid';
  cols: Expr;
  rows: Expr;
  spacing?: Expr;
  spacingX?: Expr;
  spacingY?: Expr;
};

/**
 * Radial iter, including operation kind, count, start, and sweep.
 */
export type RadialIter = {
  kind: 'radial';
  count: Expr;
  start?: Expr;
  sweep?: Expr;
};

/**
 * List iter, including operation kind and expr.
 */
export type ListIter = { kind: 'list'; expr: Expr };

/**
 * Enumerate iter, including operation kind and expr.
 */
export type EnumerateIter = { kind: 'enumerate'; expr: Expr };

/**
 * If statement, including operation kind, condition, then, else, and span.
 */
export type IfStatement = {
  kind: 'if';
  condition: Expr;
  then: ComponentBody;
  else: ComponentBody | null;
  span: ASTSourceSpan;
};
