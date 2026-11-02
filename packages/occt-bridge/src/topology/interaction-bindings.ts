/**
 * @author Aidan Boissonneault
 * @file interaction-bindings.ts
 * @purpose Provides interaction bindings behavior for the topology in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

import type {
  InteractionEntity,
  InteractionSnapshot,
  IRPlacement,
} from '@bushscad/ir';
import type { OC } from '../bridge/bridge-types.js';
import type { FaceLabelMap } from './face-labels.js';
import { sameShape } from './shape-collection.js';

/**
 * Interaction topology bindings, including face ids, edge ids, corner ids, reference points for
 * face, and unmatched reference points.
 */
export type InteractionTopologyBindings = {
  faceIds: (face: unknown) => string[];
  edgeIds: (edge: unknown) => string[];
  cornerIds: (point: readonly [number, number, number]) => string[];
  referencePointsForFace: (face: unknown) => readonly PointBinding[];
  unmatchedReferencePoints: () => readonly PointBinding[];
};

/**
 * Handle binding, including handle and identifier.
 */
type HandleBinding = { handle: unknown; id: string };
/**
 * Point binding, including point and identifier.
 */
export type PointBinding = { point: [number, number, number]; id: string };
/**
 * Derives `ReferencePointBinding` from `PointBinding & { faceHandles: unknown[] }` to preserve its
 * type relationship in the topology layer.
 */
type ReferencePointBinding = PointBinding & { faceHandles: unknown[] };

/** Resolves semantic snapshot records to live OCCT handles for one part build. */
export function createInteractionTopologyBindings(
  oc: OC,
  snapshot: InteractionSnapshot | undefined,
  labelMap: FaceLabelMap,
  partEntityId?: string,
): InteractionTopologyBindings {
  const faces: HandleBinding[] = [];
  const edges: HandleBinding[] = [];
  const corners: PointBinding[] = [];
  const referencePoints: ReferencePointBinding[] = [];
  const matchedReferencePointIds = new Set<string>();
  const entityById = new Map(
    snapshot?.entities.map((entity) => [entity.id, entity]) ?? [],
  );
  for (const entity of snapshot?.entities ?? []) {
    if (partEntityId && !ownedByPart(entity, partEntityId, entityById)) {
      continue;
    }
    bindEntity(oc, labelMap, entity, faces, edges, corners, referencePoints);
  }
  return {
    faceIds: (face) => bindingIds(faces, face),
    edgeIds: (edge) => bindingIds(edges, edge),
    cornerIds: (point) => pointBindingIds(corners, point),
    referencePointsForFace: (face) =>
      referencePointBindingsForFace(
        referencePoints,
        face,
        matchedReferencePointIds,
      ),
    unmatchedReferencePoints: () =>
      referencePoints
        .filter((binding) => !matchedReferencePointIds.has(binding.id))
        .map(({ id, point }) => ({ id, point })),
  };
}

/**
 * Handles owned by part in the topology flow.
 */
function ownedByPart(
  entity: InteractionEntity,
  partEntityId: string,
  entities: ReadonlyMap<string, InteractionEntity>,
): boolean {
  let current: InteractionEntity | undefined = entity;
  while (current) {
    if (current.id === partEntityId) return true;
    current = current.ownerId ? entities.get(current.ownerId) : undefined;
  }
  return false;
}

/**
 * Handles bind entity in the topology flow.
 */
function bindEntity(
  oc: OC,
  labels: FaceLabelMap,
  entity: InteractionEntity,
  faces: HandleBinding[],
  edges: HandleBinding[],
  corners: PointBinding[],
  referencePoints: ReferencePointBinding[],
): void {
  if (isObjectKind(entity.kind)) {
    bindObjectEntity(oc, labels, entity, faces, edges);
    return;
  }
  if (entity.placement) {
    bindPlacementReference(
      oc,
      labels,
      entity,
      entity.placement,
      referencePoints,
    );
    return;
  }
  if (entity.kind === 'face') {
    addHandles(
      faces,
      labels.resolveSemanticFaceHandles(oc, entity.name),
      entity.id,
    );
  } else if (entity.kind === 'edge') {
    addHandles(edges, labels.resolveEdges(oc, entity.name), entity.id);
  } else if (entity.kind === 'corner' || entity.kind === 'point') {
    bindPointEntity(oc, labels, entity, corners, referencePoints);
  }
}

/**
 * Handles bind object entity in the topology flow.
 */
function bindObjectEntity(
  oc: OC,
  labels: FaceLabelMap,
  entity: InteractionEntity,
  faces: HandleBinding[],
  edges: HandleBinding[],
): void {
  addHandles(faces, labels.getFeatureFaceHandles(entity.name), entity.id);
  addHandles(edges, labels.getFeatureEdgeHandles(oc, entity.name), entity.id);
}

/**
 * Handles bind point entity in the topology flow.
 */
function bindPointEntity(
  oc: OC,
  labels: FaceLabelMap,
  entity: InteractionEntity,
  corners: PointBinding[],
  referencePoints: ReferencePointBinding[],
): void {
  const point = resolvePoint(
    oc,
    labels,
    entity.placement ?? { faceRef: entity.name },
  );
  if (!point) return;
  if (entity.kind === 'corner') {
    corners.push({ point, id: entity.id });
    return;
  }
  if (entity.placement) return;
  referencePoints.push({
    point,
    id: entity.id,
    faceHandles: labels.resolveSemanticFaceHandles(oc, entity.name),
  });
}

/** Binds an exact placement point to the face that owns its local axis. */
function bindPlacementReference(
  oc: OC,
  labels: FaceLabelMap,
  entity: InteractionEntity,
  placement: IRPlacement,
  referencePoints: ReferencePointBinding[],
): void {
  const point = resolvePoint(oc, labels, placement);
  if (!point) return;
  referencePoints.push({
    point,
    id: entity.id,
    faceHandles: labels.resolveSemanticFaceHandles(oc, placement.faceRef),
  });
}

/**
 * Returns whether the input meets the `object kind` condition.
 */
function isObjectKind(kind: InteractionEntity['kind']): boolean {
  return (
    kind === 'object' ||
    kind === 'generated-instance' ||
    kind === 'surface' ||
    kind === 'imported'
  );
}

/**
 * Adds handles to its owning collection.
 */
function addHandles(
  bindings: HandleBinding[],
  handles: unknown[],
  id: string,
): void {
  for (const handle of handles) bindings.push({ handle, id });
}

/**
 * Handles binding ids in the topology flow.
 */
function bindingIds(bindings: HandleBinding[], handle: unknown): string[] {
  return [
    ...new Set(
      bindings
        .filter((binding) => sameShape(binding.handle, handle))
        .map((binding) => binding.id),
    ),
  ];
}

/**
 * Resolves point against the current shape and its topology labels.
 */
function resolvePoint(
  oc: OC,
  labels: FaceLabelMap,
  placement: IRPlacement,
): [number, number, number] | null {
  try {
    const axis = labels.resolveAxis(oc, placement) as {
      Location(): { X(): number; Y(): number; Z(): number; delete?(): void };
      delete?(): void;
    };
    const location = axis.Location();
    const point: [number, number, number] = [
      location.X(),
      location.Y(),
      location.Z(),
    ];
    location.delete?.();
    axis.delete?.();
    return point;
  } catch {
    return null;
  }
}

/**
 * Creates point geometry from the supplied coordinates.
 */
function pointBindingIds(
  bindings: PointBinding[],
  point: readonly [number, number, number],
): string[] {
  return bindings
    .filter(
      (binding) =>
        Math.hypot(
          binding.point[0] - point[0],
          binding.point[1] - point[1],
          binding.point[2] - point[2],
        ) < 1e-5,
    )
    .map((binding) => binding.id);
}

/** Finds placement points owned by one live face without tagging that face. */
function referencePointBindingsForFace(
  bindings: ReferencePointBinding[],
  face: unknown,
  matchedIds: Set<string>,
): PointBinding[] {
  return bindings.flatMap((binding) => {
    if (
      matchedIds.has(binding.id) ||
      !binding.faceHandles.some((handle) => sameShape(handle, face))
    ) {
      return [];
    }
    matchedIds.add(binding.id);
    return [{ id: binding.id, point: binding.point }];
  });
}
