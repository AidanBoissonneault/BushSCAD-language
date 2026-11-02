/**
 * @author Aidan Boissonneault
 * @file surface.ts
 * @purpose Provides surface behavior for the ast in IR package.
 * @last-edited October 6, 2026
 */

import type { ASTSourceSpan } from './sourceSpan.js';
import type { Expr, RepeatableFaceRef } from './expressions.js';
import type { SurfaceInput } from './operations.js';

/**
 * Surface fill op, including operation kind, boundary, and span.
 */
export type SurfaceFillOp = {
  kind: 'fill';
  boundary: RepeatableFaceRef;
  span: ASTSourceSpan;
};

/**
 * Surface offset op, including operation kind, surface, distance, and span.
 */
export type SurfaceOffsetOp = {
  kind: 'offset_surface';
  surface: SurfaceInput;
  distance: Expr;
  span: ASTSourceSpan;
};

/**
 * Surface operation accepts SurfaceFillOp and SurfaceOffsetOp.
 */
export type SurfaceOperation = SurfaceFillOp | SurfaceOffsetOp;

/**
 * Surface decl, including operation kind, name, name span, operation, and span.
 */
export type SurfaceDecl = {
  kind: 'surface';
  name: string;
  nameSpan?: ASTSourceSpan;
  operation: SurfaceOperation;
  span: ASTSourceSpan;
};
