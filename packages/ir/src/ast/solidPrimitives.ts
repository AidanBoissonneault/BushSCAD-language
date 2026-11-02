/**
 * @author Aidan Boissonneault
 * @file solidPrimitives.ts
 * @purpose Provides solid primitives behavior for the ast in IR package.
 * @last-edited October 6, 2026
 */

import type { Expr, RepeatableSpatialRef } from './expressions.js';
import type { ASTSourceSpan } from './sourceSpan.js';

/**
 * Accepted values for solid primitive name are 'cube', 'cuboid', 'sphere', 'ellipsoid',
 * 'geodesicSphere', 'cylinder', 'cylinderElliptic', 'cone', 'frustum', 'roundedCuboid',
 * 'roundedCylinder', 'torus', and 'polyhedron'.
 */
export type SolidPrimitiveName =
  | 'cube'
  | 'cuboid'
  | 'sphere'
  | 'ellipsoid'
  | 'geodesicSphere'
  | 'cylinder'
  | 'cylinderElliptic'
  | 'cone'
  | 'frustum'
  | 'roundedCuboid'
  | 'roundedCylinder'
  | 'torus'
  | 'polyhedron';

/**
 * Solid primitive arg, including name, display value, and span.
 */
export type SolidPrimitiveArg = {
  name: string | null;
  value: Expr;
  span: ASTSourceSpan;
};

/**
 * Solid primitive op, including operation kind, primitive, args, placement, and span.
 */
export type SolidPrimitiveOp = {
  kind: 'solidPrimitive';
  primitive: SolidPrimitiveName;
  args: SolidPrimitiveArg[];
  placement: RepeatableSpatialRef | null;
  span: ASTSourceSpan;
};
