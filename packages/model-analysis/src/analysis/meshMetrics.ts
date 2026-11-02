/**
 * @author Aidan Boissonneault
 * @file meshMetrics.ts
 * @purpose Provides mesh metrics behavior for the analysis in model analysis package.
 * @last-edited October 6, 2026
 */

import type { MeshData } from '@bushscad/ir';
import type { Bounds3 } from '../types/types.js';
import { cross, dot, length, subtract, type Vec3 } from '../types/vector.js';
import { triangles } from './meshAccess.js';

/**
 * Measurements for basic mesh, including 3D bounds, center, dimensions, surface area, and signed
 * volume.
 */
type BasicMeshMetrics = {
  bounds: Bounds3;
  center: Vec3;
  dimensions: Vec3;
  surfaceArea: number;
  signedVolume: number;
  degenerateTriangles: number;
  invalidNormals: number;
};

/**
 * Computes stable scalar metrics from a preview mesh.
 * These numbers make geometry changes reviewable even when a visual difference
 * is subtle or camera-dependent.
 */
export function computeMeshMetrics(mesh: MeshData): BasicMeshMetrics {
  const bounds = computeBounds(mesh);
  const dims: Vec3 = [
    bounds.max[0] - bounds.min[0],
    bounds.max[1] - bounds.min[1],
    bounds.max[2] - bounds.min[2],
  ];
  let surfaceArea = 0;
  let signedVolume = 0;
  let degenerateTriangles = 0;

  for (const [a, b, c] of triangles(mesh)) {
    const areaVector = cross(subtract(b, a), subtract(c, a));
    const area = length(areaVector) / 2;
    if (area <= 1e-8) degenerateTriangles++;
    surfaceArea += area;
    signedVolume += dot(a, cross(b, c)) / 6;
  }

  return {
    bounds,
    center: [
      (bounds.min[0] + bounds.max[0]) / 2,
      (bounds.min[1] + bounds.max[1]) / 2,
      (bounds.min[2] + bounds.max[2]) / 2,
    ],
    dimensions: dims,
    surfaceArea,
    signedVolume,
    degenerateTriangles,
    invalidNormals: countInvalidNormals(mesh),
  };
}

/**
 * Handles compute bounds in the analysis flow.
 */
function computeBounds(mesh: MeshData): Bounds3 {
  const min: Vec3 = [Infinity, Infinity, Infinity];
  const max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i + 2 < mesh.vertices.length; i += 3) {
    for (let axis = 0; axis < 3; axis++) {
      const value = mesh.vertices[i + axis] ?? 0;
      min[axis] = Math.min(min[axis], value);
      max[axis] = Math.max(max[axis], value);
    }
  }
  if (!Number.isFinite(min[0])) return { min: [0, 0, 0], max: [0, 0, 0] };
  return { min, max };
}

/**
 * Handles count invalid normals in the analysis flow.
 */
function countInvalidNormals(mesh: MeshData): number {
  let invalid = 0;
  for (let i = 0; i + 2 < mesh.normals.length; i += 3) {
    const normal: Vec3 = [
      mesh.normals[i] ?? 0,
      mesh.normals[i + 1] ?? 0,
      mesh.normals[i + 2] ?? 0,
    ];
    if (!normal.every(Number.isFinite) || length(normal) <= 1e-8) invalid++;
  }
  return invalid;
}
