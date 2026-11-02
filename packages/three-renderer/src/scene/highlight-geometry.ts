/**
 * @author Aidan Boissonneault
 * @file highlight-geometry.ts
 * @purpose Provides highlight geometry behavior for the scene in three renderer package.
 * @last-edited October 6, 2026
 */

import * as THREE from 'three';
import type {
  InteractionFaceRange,
  InteractionMeshTopology,
  InteractionPoint,
  InteractionPolyline,
} from '@bushscad/ir';

/**
 * Selection of highlight topology, including faces, edges, corners, and whole mesh.
 */
export type HighlightTopologySelection = {
  readonly faces: readonly InteractionFaceRange[];
  readonly edges: readonly InteractionPolyline[];
  readonly corners: readonly InteractionPoint[];
  readonly wholeMesh: boolean;
};

/** Resolves semantic, owner, part, object, or exact topology IDs for one mesh. */
export function selectHighlightTopology(
  topology: InteractionMeshTopology,
  targetIds: ReadonlySet<string>,
): HighlightTopologySelection {
  const wholeMesh =
    targetIds.has(topology.partEntityId) ||
    Boolean(topology.objectEntityId && targetIds.has(topology.objectEntityId));
  const faces = topology.faces.filter(
    (face) => wholeMesh || topologyTargetMatches(face, targetIds),
  );
  const edges = topology.edges.filter(
    (edge) => wholeMesh || topologyTargetMatches(edge, targetIds),
  );
  const corners = topology.corners.filter((corner) =>
    corner.role === 'reference-point'
      ? referencePointMatches(corner, targetIds)
      : wholeMesh || topologyTargetMatches(corner, targetIds),
  );
  return {
    faces,
    edges,
    corners,
    wholeMesh:
      wholeMesh ||
      (topology.faces.length > 0 && faces.length === topology.faces.length),
  };
}

/**
 * Resolves the reference against its owning declaration.
 */
function referencePointMatches(
  point: InteractionPoint,
  requested: ReadonlySet<string>,
): boolean {
  return (
    requested.has(point.id) ||
    point.semanticTargetIds.some((id) => requested.has(id))
  );
}

/** Builds one non-indexed face overlay while suppressing overlapping triangles. */
export function createFaceHighlightGeometry(
  source: THREE.BufferGeometry,
  ranges: readonly InteractionFaceRange[],
): THREE.BufferGeometry | null {
  const position = source.getAttribute('position');
  const normal = source.getAttribute('normal');
  const index = source.getIndex();
  if (!position || !index || ranges.length === 0) return null;
  const triangles = new Set<number>();
  for (const range of ranges) {
    const end = range.triangleStart + range.triangleCount;
    for (let triangle = range.triangleStart; triangle < end; triangle += 1) {
      triangles.add(triangle);
    }
  }
  const positions: number[] = [];
  const normals: number[] = [];
  for (const triangle of triangles) {
    for (let corner = 0; corner < 3; corner += 1) {
      const vertex = index.getX(triangle * 3 + corner);
      positions.push(
        position.getX(vertex),
        position.getY(vertex),
        position.getZ(vertex),
      );
      if (normal) {
        normals.push(
          normal.getX(vertex),
          normal.getY(vertex),
          normal.getZ(vertex),
        );
      }
    }
  }
  if (positions.length === 0) return null;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3),
  );
  if (normals.length === positions.length) {
    geometry.setAttribute(
      'normal',
      new THREE.Float32BufferAttribute(normals, 3),
    );
  } else {
    geometry.computeVertexNormals();
  }
  return geometry;
}

/** Flattens unique compiler edge polylines into independent line segments. */
export function edgeSegmentPositions(
  edges: readonly InteractionPolyline[],
): Float32Array {
  const positions: number[] = [];
  const seen = new Set<string>();
  for (const edge of edges) {
    if (seen.has(edge.id)) continue;
    seen.add(edge.id);
    for (let index = 0; index + 5 < edge.points.length; index += 3) {
      positions.push(
        edge.points[index]!,
        edge.points[index + 1]!,
        edge.points[index + 2]!,
        edge.points[index + 3]!,
        edge.points[index + 4]!,
        edge.points[index + 5]!,
      );
    }
  }
  return new Float32Array(positions);
}

/** Flattens unique compiler corner points for a scale-stable Points overlay. */
export function cornerPositions(
  corners: readonly InteractionPoint[],
): Float32Array {
  const positions: number[] = [];
  const seen = new Set<string>();
  for (const corner of corners) {
    if (seen.has(corner.id)) continue;
    seen.add(corner.id);
    positions.push(...corner.point);
  }
  return new Float32Array(positions);
}

/** Computes world bounds from exactly the selected topology on one scene mesh. */
export function includeHighlightBounds(
  bounds: THREE.Box3,
  mesh: THREE.Mesh,
  selection: HighlightTopologySelection,
): void {
  mesh.updateWorldMatrix(true, false);
  if (selection.wholeMesh) {
    includeWholeMeshBounds(bounds, mesh);
    return;
  }
  includeFaceBounds(bounds, mesh, selection.faces);
  for (const edge of selection.edges) {
    includePoints(bounds, edge.points, mesh.matrixWorld);
  }
  for (const corner of selection.corners) {
    includePoints(bounds, corner.point, mesh.matrixWorld);
  }
}

/**
 * Handles include whole mesh bounds in the scene flow.
 */
function includeWholeMeshBounds(bounds: THREE.Box3, mesh: THREE.Mesh): void {
  if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
  if (!mesh.geometry.boundingBox) return;
  bounds.union(
    mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld),
  );
}

/**
 * Handles include face bounds in the scene flow.
 */
function includeFaceBounds(
  bounds: THREE.Box3,
  mesh: THREE.Mesh,
  faces: readonly InteractionFaceRange[],
): void {
  const position = mesh.geometry.getAttribute('position');
  const index = mesh.geometry.getIndex();
  if (!position || !index) return;
  const worldPoint = new THREE.Vector3();
  for (const face of faces) {
    const end = face.triangleStart + face.triangleCount;
    for (let triangle = face.triangleStart; triangle < end; triangle += 1) {
      for (let corner = 0; corner < 3; corner += 1) {
        const vertex = index.getX(triangle * 3 + corner);
        worldPoint
          .set(
            position.getX(vertex),
            position.getY(vertex),
            position.getZ(vertex),
          )
          .applyMatrix4(mesh.matrixWorld);
        bounds.expandByPoint(worldPoint);
      }
    }
  }
}

/**
 * Handles topology target matches in the scene flow.
 */
function topologyTargetMatches(
  target: {
    readonly id: string;
    readonly ownerEntityId: string;
    readonly semanticTargetIds: readonly string[];
  },
  requested: ReadonlySet<string>,
): boolean {
  return (
    requested.has(target.id) ||
    requested.has(target.ownerEntityId) ||
    target.semanticTargetIds.some((id) => requested.has(id))
  );
}

/**
 * Handles include points in the scene flow.
 */
function includePoints(
  bounds: THREE.Box3,
  points: readonly number[],
  matrix: THREE.Matrix4,
): void {
  const point = new THREE.Vector3();
  for (let index = 0; index + 2 < points.length; index += 3) {
    point.set(points[index]!, points[index + 1]!, points[index + 2]!);
    bounds.expandByPoint(point.applyMatrix4(matrix));
  }
}
