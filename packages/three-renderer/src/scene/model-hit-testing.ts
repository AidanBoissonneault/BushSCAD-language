/**
 * @author Aidan Boissonneault
 * @file model-hit-testing.ts
 * @purpose Provides model hit testing behavior for the scene in three renderer package.
 * @last-edited October 6, 2026
 */

import * as THREE from 'three';
import type { InteractionFaceRange, InteractionSnapshot } from '@bushscad/ir';

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
  readonly sketchInstanceId?: string;
  readonly unsupportedReason?: string;
};

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
  for (const intersection of raycaster.intersectObjects([...meshes], false)) {
    const hit = resolveModelIntersection(intersection, snapshot);
    if (hit) return hit;
  }
  return null;
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
