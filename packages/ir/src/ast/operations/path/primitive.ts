import type { ASTSourceSpan } from '../../sourceSpan.js';
import type { Expr } from '../../expressions.js';

/**
 * Point3 d, including x, y, and z.
 */
export type Point3D = { x: Expr; y: Expr; z: Expr };

/**
 * Primitive for path is tagged by kind: 'polyline' and 'spline'.
 */
export type PathPrimitive =
  | { kind: 'polyline'; points: Point3D[]; span: ASTSourceSpan }
  | { kind: 'spline'; points: Point3D[]; span: ASTSourceSpan };
