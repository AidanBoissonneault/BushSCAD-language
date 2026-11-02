/**
 * @author Aidan Boissonneault
 * @file meshAccess.ts
 * @purpose Provides mesh access behavior for the analysis in model analysis package.
 * @last-edited October 6, 2026
 */

import type { MeshData } from '@bushscad/ir';
import type { Vec3 } from '../types/vector.js';

/**
 * triangle represented by [Vec3, Vec3, Vec3].
 */
type Triangle = [Vec3, Vec3, Vec3];

/**
 * Builds the mesh data required by the current operation.
 */
export function meshKey(mesh: MeshData): string {
  return `${mesh.partName}:${mesh.bodyName ?? mesh.partName}`;
}

/**
 * Handles vertex at in the analysis flow.
 */
function vertexAt(mesh: MeshData, index: number): Vec3 {
  const offset = index * 3;
  return [
    mesh.vertices[offset] ?? 0,
    mesh.vertices[offset + 1] ?? 0,
    mesh.vertices[offset + 2] ?? 0,
  ];
}

/**
 * Iterates triangles using the mesh index buffer.
 * All metric, topology, and slicing checks need identical triangle traversal
 * to keep diagnostics comparable across report sections.
 */
export function triangles(mesh: MeshData): Triangle[] {
  const result: Triangle[] = [];
  for (let i = 0; i + 2 < mesh.indices.length; i += 3) {
    result.push([
      vertexAt(mesh, mesh.indices[i] ?? 0),
      vertexAt(mesh, mesh.indices[i + 1] ?? 0),
      vertexAt(mesh, mesh.indices[i + 2] ?? 0),
    ]);
  }
  return result;
}
