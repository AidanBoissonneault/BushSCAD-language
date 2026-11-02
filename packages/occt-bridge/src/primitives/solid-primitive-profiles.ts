/**
 * @author Aidan Boissonneault
 * @file solid-primitive-profiles.ts
 * @purpose Provides solid primitive profiles behavior for the primitives in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

import type { Vec3 } from '../core/geometry-utils.js';

/**
 * Creates a closed radial profile for cylinders, cones, and frustums.
 * Revolved primitives need a stable 2D profile that avoids duplicate apex
 * points while still closing against the local Z axis.
 */
export function radialProfile(
  radiusBottom: number,
  radiusTop: number,
  height: number,
): [number, number][] {
  const points: [number, number][] = [
    [radiusBottom, 0],
    [radiusTop, height],
  ];
  if (radiusTop > 1e-9) points.push([0, height]);
  points.push([0, 0]);
  return points;
}

/**
 * Creates a semicircular profile for a sphere-like revolved solid.
 * OCCT can build the primitive consistently from the same revolve path used
 * for ellipsoid and torus support.
 */
export function sphereProfile(
  radius: number,
  segments: number,
): [number, number][] {
  const points: [number, number][] = [[0, -radius]];
  for (let i = 1; i < segments; i++) {
    const a = -Math.PI / 2 + (Math.PI * i) / segments;
    points.push([Math.cos(a) * radius, Math.sin(a) * radius]);
  }
  points.push([0, radius]);
  return points;
}

/**
 * Creates a spheroid profile for a revolved ellipsoid primitive.
 * BushSCAD carries a 3-axis ellipsoid contract, while this bridge path can
 * currently produce the rotationally symmetric OCCT representation.
 */
export function ellipsoidProfile(
  radius: number,
  heightRadius: number,
  segments: number,
): [number, number][] {
  const points: [number, number][] = [[0, -heightRadius]];
  for (let i = 1; i < segments; i++) {
    const a = -Math.PI / 2 + (Math.PI * i) / segments;
    points.push([Math.cos(a) * radius, Math.sin(a) * heightRadius]);
  }
  points.push([0, heightRadius]);
  return points;
}

/**
 * Creates a closed circular tube profile for a torus.
 * The torus uses a profile offset from the Z axis and then revolves it through
 * a full turn.
 */
export function torusProfile(
  major: number,
  minor: number,
  segments: number,
): [number, number][] {
  return Array.from({ length: segments }, (_, i) => {
    const a = (Math.PI * 2 * i) / segments;
    return [major + Math.cos(a) * minor, Math.sin(a) * minor];
  });
}

/**
 * Tessellates an elliptic cylinder into face loops for compound construction.
 * OCCT's revolve path only handles circular sections; this keeps the elliptic
 * variant available without mixing mesh generation into the dispatcher.
 */
export function ellipticCylinderMesh(
  start: [number, number],
  end: [number, number],
  height: number,
  segments: number,
): { points: Vec3[]; faces: number[][] } {
  const cols = Math.max(12, segments);
  const points: Vec3[] = [];
  for (const [rx, ry, z] of [
    [start[0], start[1], 0],
    [end[0], end[1], height],
  ] as const) {
    for (let c = 0; c < cols; c++) {
      const u = (Math.PI * 2 * c) / cols;
      points.push([Math.cos(u) * rx, Math.sin(u) * ry, z]);
    }
  }
  const faces = [
    Array.from({ length: cols }, (_, i) => cols - 1 - i),
    Array.from({ length: cols }, (_, i) => cols + i),
  ];
  for (let c = 0; c < cols; c++)
    faces.push([c, (c + 1) % cols, cols + ((c + 1) % cols), cols + c]);
  return { points, faces };
}
