/**
 * @author Aidan Boissonneault
 * @file slices.ts
 * @purpose Provides slices behavior for the analysis in model analysis package.
 * @last-edited October 6, 2026
 */

import type { MeshData } from '@bushscad/ir';
import type { Bounds3, SliceSample, SliceWarning } from '../types/types.js';
import { meshKey, triangles } from './meshAccess.js';
import { add, scale, type Vec3 } from '../types/vector.js';

/**
 * Samples horizontal sections through a mesh.
 * Loft regressions show up as abrupt cross-section changes, missing contours,
 * or shifted centroids before they are obvious in a single shaded view.
 */
export function analyzeSlices(mesh: MeshData, count = 9): SliceSample[] {
  const keyTriangles = triangles(mesh);
  const zValues = keyTriangles.flatMap((tri) => tri.map((point) => point[2]));
  const minZ = Math.min(...zValues);
  const maxZ = Math.max(...zValues);
  if (!Number.isFinite(minZ) || maxZ <= minZ) return [];

  return Array.from({ length: count }, (_, index) => {
    const z = minZ + ((maxZ - minZ) * (index + 1)) / (count + 1);
    const points = keyTriangles.flatMap((tri) => intersectTriangleAtZ(tri, z));
    return sampleFromPoints(z, points);
  });
}

/**
 * Handles slice warnings in the analysis flow.
 */
export function sliceWarnings(
  mesh: MeshData,
  samples: SliceSample[],
): SliceWarning[] {
  const warnings: SliceWarning[] = [];
  for (let i = 1; i < samples.length; i++) {
    const prev = samples[i - 1];
    const current = samples[i];
    if (!prev || !current || prev.areaEstimate <= 1e-8) continue;
    const ratio =
      Math.abs(current.areaEstimate - prev.areaEstimate) / prev.areaEstimate;
    if (ratio > 0.45) {
      warnings.push({
        meshKey: meshKey(mesh),
        z: current.z,
        message: `Slice area changed by ${(ratio * 100).toFixed(1)}% from previous sample`,
      });
    }
  }
  return warnings;
}

/**
 * Handles intersect triangle at z in the analysis flow.
 */
function intersectTriangleAtZ(tri: [Vec3, Vec3, Vec3], z: number): Vec3[] {
  const points: Vec3[] = [];
  addIntersection(points, tri[0], tri[1], z);
  addIntersection(points, tri[1], tri[2], z);
  addIntersection(points, tri[2], tri[0], z);
  return points;
}

/**
 * Adds intersection to its owning collection.
 */
function addIntersection(points: Vec3[], a: Vec3, b: Vec3, z: number): void {
  const dzA = a[2] - z;
  const dzB = b[2] - z;
  if (dzA === 0 && dzB === 0) return;
  if (dzA * dzB > 0) return;
  const denom = b[2] - a[2];
  if (Math.abs(denom) <= 1e-8) return;
  const t = (z - a[2]) / denom;
  if (t < 0 || t > 1) return;
  points.push(add(a, scale([b[0] - a[0], b[1] - a[1], b[2] - a[2]], t)));
}

/**
 * Handles sample from points in the analysis flow.
 */
function sampleFromPoints(z: number, points: Vec3[]): SliceSample {
  if (points.length === 0) {
    return {
      z,
      bounds: null,
      centroid: null,
      areaEstimate: 0,
      contourSegments: 0,
    };
  }
  const bounds = boundsFromPoints(points);
  const centroid = scale(
    points.reduce<Vec3>((sum, point) => add(sum, point), [0, 0, 0]),
    1 / points.length,
  );
  return {
    z,
    bounds,
    centroid,
    areaEstimate:
      (bounds.max[0] - bounds.min[0]) * (bounds.max[1] - bounds.min[1]),
    contourSegments: Math.floor(points.length / 2),
  };
}

/**
 * Calculates the bounds of the supplied geometry.
 */
function boundsFromPoints(points: Vec3[]): Bounds3 {
  const min: Vec3 = [Infinity, Infinity, Infinity];
  const max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const point of points) {
    for (let axis = 0; axis < 3; axis++) {
      min[axis] = Math.min(min[axis], point[axis]);
      max[axis] = Math.max(max[axis], point[axis]);
    }
  }
  return { min, max };
}
