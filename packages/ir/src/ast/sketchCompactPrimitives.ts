/**
 * @author Aidan Boissonneault
 * @file sketchCompactPrimitives.ts
 * @purpose Provides sketch compact primitives behavior for the ast in IR package.
 * @last-edited October 6, 2026
 */

import type { ASTSourceSpan } from './sourceSpan.js';
import type { Expr } from './expressions.js';
import type {
  CompactSketchDimensionDecl,
  CompactSketchParameter,
} from './sketchAnnotations.js';
import type {
  RectSide,
  RectSideNames,
  SketchOriginOption,
} from './sketchPrimitiveOptions.js';

/**
 * Compact dimension fields, including compact dimensions and dimension placeholders.
 */
type CompactDimensionFields = {
  compactDimensions?: CompactSketchDimensionDecl[];
  dimensionPlaceholders?: Partial<
    Record<CompactSketchParameter, ASTSourceSpan>
  >;
};

/**
 * Derives `RectPrimitive` from `SketchOriginOption & CompactDimensionFields & { kind: 'rect'; width:
 * Expr; height: Expr; cornerRadius?: Expr; sideNames?: RectSideNames; plant?: RectSide; span:
 * ASTSourceSpan; }` to preserve its type relationship in the ast layer.
 */
export type RectPrimitive = SketchOriginOption &
  CompactDimensionFields & {
    kind: 'rect';
    width: Expr;
    height: Expr;
    cornerRadius?: Expr;
    sideNames?: RectSideNames;
    plant?: RectSide;
    span: ASTSourceSpan;
  };

/**
 * Derives `CirclePrimitive` from `SketchOriginOption & CompactDimensionFields & { kind: 'circle';
 * diameter: Expr; span: ASTSourceSpan; }` to preserve its type relationship in the ast layer.
 */
export type CirclePrimitive = SketchOriginOption &
  CompactDimensionFields & {
    kind: 'circle';
    diameter: Expr;
    span: ASTSourceSpan;
  };

/**
 * Derives `EllipsePrimitive` from `SketchOriginOption & CompactDimensionFields & { kind: 'ellipse';
 * width: Expr; height: Expr; span: ASTSourceSpan; }` to preserve its type relationship in the ast
 * layer.
 */
export type EllipsePrimitive = SketchOriginOption &
  CompactDimensionFields & {
    kind: 'ellipse';
    width: Expr;
    height: Expr;
    span: ASTSourceSpan;
  };

/**
 * Derives `RoundRectPrimitive` from `SketchOriginOption & CompactDimensionFields & { kind:
 * 'roundrect'; width: Expr; height: Expr; radius: Expr; span: ASTSourceSpan; }` to preserve its type
 * relationship in the ast layer.
 */
export type RoundRectPrimitive = SketchOriginOption &
  CompactDimensionFields & {
    kind: 'roundrect';
    width: Expr;
    height: Expr;
    radius: Expr;
    span: ASTSourceSpan;
  };
