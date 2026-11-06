/**
 * @author Aidan Boissonneault
 * @file model-hit-testing.ts
 * @purpose Provides model hit testing behavior for the scene in three renderer package.
 * @last-edited October 6, 2026
 */

import * as THREE from 'three';
import type {
  InteractionFaceRange,
  InteractionMeshTopology,
  InteractionSnapshot,
} from '@bushscad/ir';

/**
 * Picking result identifying a mesh triangle and its semantic model target.
 */
export type ModelHit = {
  readonly meshIndex: number;
  readonly triangleIndex: number;
  readonly topologyId: string;
  readonly ownerEntityId: string;
  readonly semanticTargetIds: readonly string[];
  readonly partEntityId: string;
  readonly objectEntityId?: string;
  readonly point: readonly [number, number, number];
  readonly normal?: readonly [number, number, number];
  readonly topologyKind?: 'face' | 'edge' | 'corner' | 'sketch';
  readonly sketchInstanceId?: string;
  readonly unsupportedReason?: string;
};

type NearbyTopologyFeature = {
  readonly kind: 'edge' | 'corner';
  readonly id: string;
  readonly ownerEntityId: string;
  readonly semanticTargetIds: readonly string[];
  readonly point: readonly [number, number, number];
  readonly distanceSquared: number;
};

const EDGE_HOVER_RADIUS_PIXELS = 6;
const CORNER_HOVER_RADIUS_PIXELS = 8;

/** Identifies the compiler mesh index carried by an interactive scene mesh. */
export function interactionMeshIndex(object: THREE.Object3D): number | null {
  const value: unknown = object.userData.interactionMeshIndex;
  return Number.isInteger(value) && (value as number) >= 0
    ? (value as number)
    : null;
}

/** Resolves one Three triangle intersection to immutable compiler provenance. */
export function resolveModelIntersection(
  intersection: THREE.Intersection,
  snapshot: InteractionSnapshot,
): ModelHit | null {
  const sketchHit = resolveSketchIntersection(intersection, snapshot);
  if (sketchHit) return sketchHit;
  const meshIndex = interactionMeshIndex(intersection.object);
  const triangleIndex = intersection.faceIndex;
  if (meshIndex === null || triangleIndex === undefined) return null;
  const topology = snapshot.topology.find(
    (candidate) => candidate.meshIndex === meshIndex,
  );
  if (!topology) return null;
  const face = topology.faces.find((candidate) =>
    containsTriangle(candidate, triangleIndex),
  );
  if (!face) return null;
  const localNormal = intersection.face?.normal;
  const normal = localNormal
    ? localNormal
        .clone()
        .applyMatrix3(
          new THREE.Matrix3().getNormalMatrix(intersection.object.matrixWorld),
        )
        .normalize()
    : undefined;
  return {
    meshIndex,
    triangleIndex,
    topologyId: face.id,
    ownerEntityId: face.ownerEntityId,
    semanticTargetIds: face.semanticTargetIds,
    partEntityId: topology.partEntityId,
    ...(topology.objectEntityId
      ? { objectEntityId: topology.objectEntityId }
      : {}),
    point: [intersection.point.x, intersection.point.y, intersection.point.z],
    ...(normal ? { normal: [normal.x, normal.y, normal.z] as const } : {}),
    topologyKind: 'face',
  };
}

/** Raycasts only caller-supplied model meshes and returns the nearest linked hit. */
export function hitTestModel(
  raycaster: THREE.Raycaster,
  camera: THREE.Camera,
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number,
  meshes: readonly THREE.Object3D[],
  snapshot: InteractionSnapshot | null,
): ModelHit | null {
  if (!snapshot || meshes.length === 0) return null;
  const rect = canvas.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  const pointer = new THREE.Vector2(
    ((clientX - rect.left) / rect.width) * 2 - 1,
    -((clientY - rect.top) / rect.height) * 2 + 1,
  );
  raycaster.setFromCamera(pointer, camera);
  raycaster.params.Line = { threshold: 1.5 };
  raycaster.params.Points = { threshold: 2.5 };
  camera.updateMatrixWorld();
  for (const intersection of raycaster.intersectObjects([...meshes], false)) {
    const hit = resolveModelIntersection(intersection, snapshot);
    if (!hit) continue;
    const topology = snapshot.topology.find(
      (candidate) => candidate.meshIndex === hit.meshIndex,
    );
    if (!topology) return hit;
    return (
      resolveNearbyTopologyFeature(
        hit,
        intersection.point,
        intersection.object,
        topology,
        camera,
        rect.height,
      ) ?? hit
    );
  }
  return null;
}

/** Promotes a face hit to a nearby edge or corner using a screen-sized tolerance. */
function resolveNearbyTopologyFeature(
  faceHit: ModelHit,
  point: THREE.Vector3,
  mesh: THREE.Object3D,
  topology: InteractionMeshTopology,
  camera: THREE.Camera,
  viewportHeight: number,
): ModelHit | null {
  mesh.updateWorldMatrix(true, false);
  const worldUnitsPerPixel = modelWorldUnitsPerPixel(
    camera,
    point,
    viewportHeight,
  );
  if (worldUnitsPerPixel <= 0) return null;
  const corner = nearestCorner(topology, mesh.matrixWorld, point);
  const edge = nearestEdge(topology, mesh.matrixWorld, point);
  const cornerRadiusSquared =
    worldUnitsPerPixel ** 2 * CORNER_HOVER_RADIUS_PIXELS ** 2;
  const edgeRadiusSquared =
    worldUnitsPerPixel ** 2 * EDGE_HOVER_RADIUS_PIXELS ** 2;
  const feature =
    corner && corner.distanceSquared <= cornerRadiusSquared
      ? corner
      : edge && edge.distanceSquared <= edgeRadiusSquared
        ? edge
        : null;
  if (!feature) return null;
  return {
    meshIndex: faceHit.meshIndex,
    triangleIndex: -1,
    topologyId: feature.id,
    ownerEntityId: feature.ownerEntityId,
    semanticTargetIds: feature.semanticTargetIds,
    partEntityId: faceHit.partEntityId,
    ...(faceHit.objectEntityId
      ? { objectEntityId: faceHit.objectEntityId }
      : {}),
    point: feature.point,
    topologyKind: feature.kind,
  };
}

/** Finds the closest real topology corner to the visible face hit. */
function nearestCorner(
  topology: InteractionMeshTopology,
  matrix: THREE.Matrix4,
  point: THREE.Vector3,
): NearbyTopologyFeature | null {
  let nearest: NearbyTopologyFeature | null = null;
  const worldPoint = new THREE.Vector3();
  for (const corner of topology.corners) {
    if (corner.role === 'reference-point') continue;
    worldPoint
      .set(corner.point[0], corner.point[1], corner.point[2])
      .applyMatrix4(matrix);
    const distanceSquared = worldPoint.distanceToSquared(point);
    if (nearest && distanceSquared >= nearest.distanceSquared) continue;
    nearest = {
      kind: 'corner',
      id: corner.id,
      ownerEntityId: corner.ownerEntityId,
      semanticTargetIds: corner.semanticTargetIds,
      point: [worldPoint.x, worldPoint.y, worldPoint.z],
      distanceSquared,
    };
  }
  return nearest;
}

/** Finds the closest point on every sampled topology edge to the visible hit. */
function nearestEdge(
  topology: InteractionMeshTopology,
  matrix: THREE.Matrix4,
  point: THREE.Vector3,
): NearbyTopologyFeature | null {
  let nearest: NearbyTopologyFeature | null = null;
  const start = new THREE.Vector3();
  const end = new THREE.Vector3();
  const closest = new THREE.Vector3();
  for (const edge of topology.edges) {
    for (let index = 0; index + 5 < edge.points.length; index += 3) {
      start
        .set(
          edge.points[index]!,
          edge.points[index + 1]!,
          edge.points[index + 2]!,
        )
        .applyMatrix4(matrix);
      end
        .set(
          edge.points[index + 3]!,
          edge.points[index + 4]!,
          edge.points[index + 5]!,
        )
        .applyMatrix4(matrix);
      const distanceSquared = closestPointOnSegment(point, start, end, closest);
      if (nearest && distanceSquared >= nearest.distanceSquared) continue;
      nearest = {
        kind: 'edge',
        id: edge.id,
        ownerEntityId: edge.ownerEntityId,
        semanticTargetIds: edge.semanticTargetIds,
        point: [closest.x, closest.y, closest.z],
        distanceSquared,
      };
    }
  }
  return nearest;
}

/** Projects onto one segment and stores the closest world-space point. */
function closestPointOnSegment(
  point: THREE.Vector3,
  start: THREE.Vector3,
  end: THREE.Vector3,
  result: THREE.Vector3,
): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const dz = end.z - start.z;
  const lengthSquared = dx * dx + dy * dy + dz * dz;
  const amount =
    lengthSquared === 0
      ? 0
      : THREE.MathUtils.clamp(
          ((point.x - start.x) * dx +
            (point.y - start.y) * dy +
            (point.z - start.z) * dz) /
            lengthSquared,
          0,
          1,
        );
  result.set(
    start.x + dx * amount,
    start.y + dy * amount,
    start.z + dz * amount,
  );
  return result.distanceToSquared(point);
}

/** Converts six CSS pixels at the hit depth into the scene's current unit size. */
function modelWorldUnitsPerPixel(
  camera: THREE.Camera,
  point: THREE.Vector3,
  viewportHeight: number,
): number {
  if (viewportHeight <= 0) return 0;
  if (camera instanceof THREE.PerspectiveCamera) {
    const depth = -point.clone().applyMatrix4(camera.matrixWorldInverse).z;
    return (
      (2 * depth * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) /
      (camera.zoom * viewportHeight)
    );
  }
  if (camera instanceof THREE.OrthographicCamera) {
    return (camera.top - camera.bottom) / (camera.zoom * viewportHeight);
  }
  return 0;
}

/**
 * Resolves sketch intersection using the scene rules.
 */
function resolveSketchIntersection(
  intersection: THREE.Intersection,
  snapshot: InteractionSnapshot,
): ModelHit | null {
  const owner = sketchInstanceOwner(intersection.object);
  const instanceId: unknown = owner?.userData.interactionSketchInstanceId;
  if (typeof instanceId !== 'string') return null;
  const instance = (snapshot.sketchInstances ?? []).find(
    (candidate) => candidate.id === instanceId,
  );
  const definition = (snapshot.sketchDefinitions ?? []).find(
    (candidate) => candidate.id === instance?.definitionId,
  );
  if (!instance || !definition) return null;
  return {
    meshIndex: -1,
    triangleIndex: -1,
    topologyId: instance.id,
    ownerEntityId: definition.entityIds[0] ?? definition.id,
    semanticTargetIds: [definition.id, ...definition.entityIds],
    partEntityId: instance.partEntityId,
    point: [intersection.point.x, intersection.point.y, intersection.point.z],
    topologyKind: 'sketch',
    sketchInstanceId: instance.id,
    ...(instance.unsupportedReason
      ? { unsupportedReason: instance.unsupportedReason }
      : {}),
  };
}

/**
 * Handles sketch instance owner in the scene flow.
 */
function sketchInstanceOwner(object: THREE.Object3D): THREE.Object3D | null {
  let current: THREE.Object3D | null = object;
  while (current) {
    if (typeof current.userData.interactionSketchInstanceId === 'string') {
      return current;
    }
    current = current.parent;
  }
  return null;
}

/**
 * Handles contains triangle in the scene flow.
 */
function containsTriangle(
  range: InteractionFaceRange,
  triangleIndex: number,
): boolean {
  return (
    triangleIndex >= range.triangleStart &&
    triangleIndex < range.triangleStart + range.triangleCount
  );
}
