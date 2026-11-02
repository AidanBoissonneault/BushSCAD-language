/**
 * @author Aidan Boissonneault
 * @file parallel-preview-contract.ts
 * @purpose Tests parallel preview contract behavior in the fixtures in cli package.
 * @last-edited October 6, 2026
 */

import type { ServiceResponse } from '../../src/dto/types.js';

/**
 * Selected members of ServiceResponse used for response from successful.
 */
type SuccessfulResponse = Extract<ServiceResponse, { ok: true }>;
/**
 * Type used for mesh contract.
 */
export type MeshContract = Readonly<{
  partName: string;
  bodyName?: string;
  color: string;
  material: NonNullable<SuccessfulResponse['meshes']>[number]['material'];
  vertexCount: number;
  triangleCount: number;
  bounds: number[][];
  sums: number[];
}>;

/** Reduces a mesh to stable geometry and ownership fields for worker parity. */
export function meshContract(
  mesh: NonNullable<SuccessfulResponse['meshes']>[number],
): MeshContract {
  const bounds = [
    [Infinity, Infinity, Infinity],
    [-Infinity, -Infinity, -Infinity],
  ];
  const sums = [0, 0, 0];
  for (let index = 0; index < mesh.vertices.length; index += 3) {
    for (let axis = 0; axis < 3; axis++) {
      const value = mesh.vertices[index + axis];
      bounds[0][axis] = Math.min(bounds[0][axis], value);
      bounds[1][axis] = Math.max(bounds[1][axis], value);
      sums[axis] += value;
    }
  }
  return {
    partName: mesh.partName,
    bodyName: mesh.bodyName,
    color: mesh.color,
    material: mesh.material,
    vertexCount: mesh.vertices.length / 3,
    triangleCount: mesh.indices.length / 3,
    bounds,
    sums,
  };
}

/** Preserves semantic identity while ignoring unstable tessellation ordering. */
export function interactionContract(
  interaction: SuccessfulResponse['interaction'],
): unknown {
  if (!interaction) return interaction;
  return {
    ...interaction,
    topology: interaction.topology.map((mesh) => ({
      meshIndex: mesh.meshIndex,
      partEntityId: mesh.partEntityId,
      objectEntityId: mesh.objectEntityId,
      faces: topologyKindContract(mesh.faces, 'triangleCount'),
      edges: topologyKindContract(mesh.edges, 'points'),
      corners: topologyKindContract(mesh.corners),
    })),
  };
}

/**
 * Handles topology kind contract in the fixtures flow.
 */
function topologyKindContract(
  entries: readonly {
    ownerEntityId: string;
    semanticTargetIds: readonly string[];
    triangleCount?: number;
    points?: readonly unknown[];
  }[],
  aggregate?: 'triangleCount' | 'points',
): unknown {
  const total = entries.reduce(
    (sum, entry) =>
      sum +
      (aggregate === 'triangleCount'
        ? (entry.triangleCount ?? 0)
        : aggregate === 'points'
          ? (entry.points?.length ?? 0)
          : 0),
    0,
  );
  return {
    count: entries.length,
    ...(aggregate === 'triangleCount' ? { triangles: total } : {}),
    ...(aggregate === 'points' ? { points: total } : {}),
    owners: [...new Set(entries.map((entry) => entry.ownerEntityId))].sort(),
    targets: [
      ...new Set(entries.flatMap((entry) => entry.semanticTargetIds)),
    ].sort(),
  };
}
