/**
 * AST contracts for for-loop bindings, iterators, and optional placement bounds.
 */
import type { ASTSourceSpan } from '../sourceSpan.js';
import type { Expr, FaceRef } from '../expressions.js';
import type { ComponentBody } from './body.js';
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
