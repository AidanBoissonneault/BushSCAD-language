/**
 * @author Aidan Boissonneault
 * @file solidPrimitives.ts
 * @purpose Provides solid primitives behavior for the geometry in IR package.
 * @last-edited October 6, 2026
 */

import type {
  IRPlacement,
  IRParamSpans,
  MaterialAppearance,
  SourceSpan,
} from '../shared/ir.js';

/**
 * Accepted values for ir solid primitive name are 'cuboid', 'sphere', 'ellipsoid',
 * 'geodesicSphere', 'cylinder', 'cylinderElliptic', 'cone', 'frustum', 'roundedCuboid',
 * 'roundedCylinder', 'torus', and 'polyhedron'.
 */
export type IRSolidPrimitiveName =
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
 * Ir solid primitive shape accepts { primitive: 'cuboid' | 'roundedCuboid'; size: [nu, {
 * primitive: 'sphere' | 'geodesicSphere'; radius: , { primitive: 'ellipsoid'; radius: [number,
 * number,, { primitive: 'cylinder' | 'roundedCylinder'; heigh, { primitive: 'cylinderElliptic';
 * height: number; s, { primitive: 'cone' | 'frustum'; height: number; r, { primitive: 'torus';
 * majorRadius: number; minorRa, and { primitive: 'polyhedron'; points: [number, number.
 */
export type IRSolidPrimitiveShape =
  | {
      primitive: 'cuboid' | 'roundedCuboid';
      size: [number, number, number];
      radius?: number;
      segments: number;
    }
  | {
      primitive: 'sphere' | 'geodesicSphere';
      radius: number;
      segments: number;
    }
  | {
      primitive: 'ellipsoid';
      radius: [number, number, number];
      segments: number;
    }
  | {
      primitive: 'cylinder' | 'roundedCylinder';
      height: number;
      radius: number;
      segments: number;
      radiusTop?: number;
      radiusBottom?: number;
      roundingRadius?: number;
    }
  | {
      primitive: 'cylinderElliptic';
      height: number;
      startRadius: [number, number];
      endRadius: [number, number];
      segments: number;
    }
  | {
      primitive: 'cone' | 'frustum';
      height: number;
      radiusTop: number;
      radiusBottom: number;
      segments: number;
    }
  | {
      primitive: 'torus';
      majorRadius: number;
      minorRadius: number;
      majorSegments: number;
      minorSegments: number;
    }
  | {
      primitive: 'polyhedron';
      points: [number, number, number][];
      faces: number[][];
    };

/**
 * Primitive for ir solid, including operation kind, obj name, shape, placement, and material.
 */
export type IRSolidPrimitive = {
  kind: 'solidPrimitive';
  objName: string;
  shape: IRSolidPrimitiveShape;
  placement: IRPlacement | null;
  material?: MaterialAppearance | null;
  paramSpans?: IRParamSpans;
  span: SourceSpan;
};
