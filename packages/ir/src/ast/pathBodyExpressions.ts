/**
 * @author Aidan Boissonneault
 * @file pathBodyExpressions.ts
 * @purpose Provides path body expressions behavior for the ast in IR package.
 * @last-edited October 6, 2026
 */

import type { Expr } from './expressions.js';
import type { ASTSourceSpan } from './sourceSpan.js';

/** Region-set expression used to name or ignore bodies within a path sketch. */
export type PathBodyExpression = PathBodyRef | PathBodyLoop | PathBodyBoolean;

/** Refers to a prior body alias, or to a feature loop when no alias exists. */
export type PathBodyRef = {
  kind: 'pathBodyRef';
  name: string;
  span: ASTSourceSpan;
};

/** Explicitly selects the source loop containing a named path feature. */
export type PathBodyLoop = {
  kind: 'pathBodyLoop';
  featureName: string;
  span: ASTSourceSpan;
};

/** Combines path body region sets with CAD-style boolean operations. */
export type PathBodyBoolean = {
  kind: 'pathBodyBoolean';
  op: 'union' | 'subtract' | 'intersect';
  left: PathBodyExpression;
  right: PathBodyExpression;
  span: ASTSourceSpan;
};

/** Names a reusable body expression inside `path(...)`. */
export type PathBodyExpressionDecl = {
  kind: 'bodyExpression';
  name: string;
  expression: PathBodyExpression;
  span: ASTSourceSpan;
};

/** Excludes every region selected by an expression from the full sketch. */
export type PathIgnoredBodyExpressionDecl = {
  kind: 'ignoredBodyExpression';
  expression: PathBodyExpression;
  span: ASTSourceSpan;
};

/** Legacy point-based declaration retained for source compatibility. */
export type PathClosedBodyDecl = {
  kind: 'closedBody';
  name: string;
  point: [Expr, Expr];
  span: ASTSourceSpan;
};

/** Legacy point-based ignore retained for bodies without semantic features. */
export type PathIgnoredClosedBodyDecl = {
  kind: 'ignoredClosedBody';
  point: [Expr, Expr];
  span: ASTSourceSpan;
};
