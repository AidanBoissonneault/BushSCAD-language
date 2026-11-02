/**
 * @author Aidan Boissonneault
 * @file interaction-snapshot-validation.ts
 * @purpose Provides interaction snapshot validation behavior for the metadata in IR package.
 * @last-edited October 6, 2026
 */

import type { InteractionSnapshot } from './interaction-provenance.js';

/**
 * Reports transport/provenance defects that interaction consumers can recover from.
 * A damaged optional interaction snapshot must disable only the affected links;
 * it must never invalidate otherwise usable meshes or exported geometry.
 */
export function interactionSnapshotIssues(
  snapshot: InteractionSnapshot,
): string[] {
  const issues: string[] = [];
  const entityIds = collectEntityIds(snapshot, issues);
  checkSelectionCounts(snapshot, issues);
  checkReferences(snapshot, entityIds, issues);
  checkTopology(snapshot, entityIds, issues);
  checkPlacementRealization(snapshot, issues);
  return [...new Set(issues)];
}

/** Rejects invalid selector cardinalities before hover allocates preview rows. */
function checkSelectionCounts(
  snapshot: InteractionSnapshot,
  issues: string[],
): void {
  for (const entity of snapshot.entities) {
    const count = entity.collectionValueCount;
    if (count !== undefined && (!Number.isSafeInteger(count) || count < 0)) {
      issues.push(`selector ${entity.id} has invalid collection value count`);
    }
    if (entity.collectionValues?.some((value) => value.trim().length === 0)) {
      issues.push(`selector ${entity.id} has an empty collection value`);
    }
    if (
      count !== undefined &&
      entity.collectionValues &&
      entity.collectionValues.length !== count
    ) {
      issues.push(`selector ${entity.id} has mismatched collection values`);
    }
  }
}

/** Rejects the physical-topology duplication that once inflated selector hover. */
function checkPlacementRealization(
  snapshot: InteractionSnapshot,
  issues: string[],
): void {
  for (const entity of snapshot.entities) {
    if (!entity.placement) continue;
    const { pointCount, hasNonPointTarget } = placementRealization(
      snapshot,
      entity.id,
    );
    if (hasNonPointTarget) {
      issues.push(`placement selector ${entity.id} owns non-point topology`);
    }
    if (pointCount > 1) {
      issues.push(
        `placement selector ${entity.id} has ${pointCount} reference points`,
      );
    }
  }
}

/** Counts exact point targets separately from invalid physical topology. */
function placementRealization(
  snapshot: InteractionSnapshot,
  entityId: string,
): { pointCount: number; hasNonPointTarget: boolean } {
  let pointCount = 0;
  let hasNonPointTarget = false;
  for (const mesh of snapshot.topology) {
    hasNonPointTarget ||= meshHasNonPointTarget(mesh, entityId);
    pointCount += mesh.corners.filter(
      (point) =>
        point.role === 'reference-point' &&
        point.semanticTargetIds.includes(entityId),
    ).length;
    hasNonPointTarget ||= mesh.corners.some(
      (point) =>
        point.role !== 'reference-point' &&
        point.semanticTargetIds.includes(entityId),
    );
  }
  return { pointCount, hasNonPointTarget };
}

/**
 * Builds the mesh data required by the current operation.
 */
function meshHasNonPointTarget(
  mesh: InteractionSnapshot['topology'][number],
  entityId: string,
): boolean {
  return [...mesh.faces, ...mesh.edges].some((target) =>
    target.semanticTargetIds.includes(entityId),
  );
}

/**
 * Collects entity ids from the supplied values.
 */
function collectEntityIds(
  snapshot: InteractionSnapshot,
  issues: string[],
): Set<string> {
  const entityIds = new Set<string>();
  for (const entity of snapshot.entities) {
    if (entityIds.has(entity.id))
      issues.push(`duplicate entity ID ${entity.id}`);
    entityIds.add(entity.id);
  }
  return entityIds;
}

/**
 * Handles check references in the metadata flow.
 */
function checkReferences(
  snapshot: InteractionSnapshot,
  entityIds: ReadonlySet<string>,
  issues: string[],
): void {
  for (const reference of snapshot.references) {
    checkEntityIds(
      issues,
      entityIds,
      reference.targetIds,
      `reference ${reference.id}`,
    );
    for (const segment of reference.segments) {
      checkEntityIds(
        issues,
        entityIds,
        segment.targetIds,
        `reference segment ${reference.id}`,
      );
    }
  }
}

/**
 * Handles check topology in the metadata flow.
 */
function checkTopology(
  snapshot: InteractionSnapshot,
  entityIds: ReadonlySet<string>,
  issues: string[],
): void {
  for (const topology of snapshot.topology) {
    checkEntityIds(
      issues,
      entityIds,
      [topology.partEntityId, topology.objectEntityId].filter(
        (id): id is string => Boolean(id),
      ),
      `mesh ${topology.meshIndex}`,
    );
    checkFaces(topology.faces, entityIds, issues);
    checkEdges(topology.edges, entityIds, issues);
    checkCorners(topology.corners, entityIds, issues);
  }
}

/**
 * Handles check faces in the metadata flow.
 */
function checkFaces(
  faces: InteractionSnapshot['topology'][number]['faces'],
  entityIds: ReadonlySet<string>,
  issues: string[],
): void {
  for (const face of faces) {
    checkEntityIds(
      issues,
      entityIds,
      [face.ownerEntityId, ...face.semanticTargetIds],
      `face ${face.id}`,
    );
    if (face.triangleStart < 0 || face.triangleCount <= 0) {
      issues.push(`face ${face.id} has an invalid triangle range`);
    }
  }
}

/**
 * Handles check edges in the metadata flow.
 */
function checkEdges(
  edges: InteractionSnapshot['topology'][number]['edges'],
  entityIds: ReadonlySet<string>,
  issues: string[],
): void {
  for (const edge of edges) {
    checkEntityIds(
      issues,
      entityIds,
      [edge.ownerEntityId, ...edge.semanticTargetIds],
      `edge ${edge.id}`,
    );
    if (edge.points.length < 6 || edge.points.length % 3 !== 0) {
      issues.push(`edge ${edge.id} has an invalid point buffer`);
    }
  }
}

/**
 * Handles check corners in the metadata flow.
 */
function checkCorners(
  corners: InteractionSnapshot['topology'][number]['corners'],
  entityIds: ReadonlySet<string>,
  issues: string[],
): void {
  for (const corner of corners) {
    checkEntityIds(
      issues,
      entityIds,
      [corner.ownerEntityId, ...corner.semanticTargetIds],
      `corner ${corner.id}`,
    );
    if (!corner.point.every(Number.isFinite)) {
      issues.push(`corner ${corner.id} has invalid coordinates`);
    }
  }
}

/**
 * Handles check entity ids in the metadata flow.
 */
function checkEntityIds(
  issues: string[],
  known: ReadonlySet<string>,
  ids: readonly string[],
  owner: string,
): void {
  for (const id of ids) {
    if (!known.has(id)) issues.push(`${owner} references missing entity ${id}`);
  }
}
