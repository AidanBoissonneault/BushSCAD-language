/**
 * @author Aidan Boissonneault
 * @file interaction-lookup.ts
 * @purpose Provides interaction lookup behavior for the metadata in IR package.
 * @last-edited October 6, 2026
 */

import type {
  InteractionEntity,
  InteractionSnapshot,
} from './interaction-provenance.js';

/** Indexes a snapshot by stable entity ID for boundary consumers. */
export function interactionEntityMap(
  snapshot: InteractionSnapshot,
): ReadonlyMap<string, InteractionEntity> {
  return new Map(snapshot.entities.map((entity) => [entity.id, entity]));
}

/** Returns all rendered topology IDs linked to one semantic/source entity. */
export function renderedTargetsForEntity(
  snapshot: InteractionSnapshot,
  entityId: string,
): string[] {
  const targets: string[] = [];
  for (const definition of snapshot.sketchDefinitions ?? []) {
    if (!definition.entityIds.includes(entityId)) continue;
    targets.push(definition.id);
    targets.push(
      ...(snapshot.sketchInstances ?? [])
        .filter((instance) => instance.definitionId === definition.id)
        .map((instance) => instance.id),
    );
  }
  for (const mesh of snapshot.topology) {
    for (const target of [...mesh.faces, ...mesh.edges, ...mesh.corners]) {
      if (
        mesh.partEntityId === entityId ||
        target.ownerEntityId === entityId ||
        target.semanticTargetIds.includes(entityId)
      ) {
        targets.push(target.id);
      }
    }
  }
  return targets;
}

/** Keeps consumed collection selectors navigable without inventing edge matches. */
export function renderedOrOwnerTargetsForEntity(
  snapshot: InteractionSnapshot,
  entityId: string,
): string[] {
  const direct = renderedTargetsForEntity(snapshot, entityId);
  if (direct.length > 0) return direct;
  const entity = snapshot.entities.find(
    (candidate) => candidate.id === entityId,
  );
  return entity?.collectionValueCount && entity.ownerId
    ? renderedTargetsForEntity(snapshot, entity.ownerId)
    : [];
}

/** Finds every source entity associated with a realized topology target. */
export function sourceEntitiesForTarget(
  snapshot: InteractionSnapshot,
  topologyId: string,
): InteractionEntity[] {
  const ids = new Set<string>();
  const sketchInstance = (snapshot.sketchInstances ?? []).find(
    (candidate) => candidate.id === topologyId,
  );
  const sketchDefinition = (snapshot.sketchDefinitions ?? []).find(
    (candidate) =>
      candidate.id === topologyId ||
      candidate.id === sketchInstance?.definitionId,
  );
  sketchDefinition?.entityIds.forEach((id) => ids.add(id));
  for (const mesh of snapshot.topology) {
    const target = [...mesh.faces, ...mesh.edges, ...mesh.corners].find(
      (candidate) => candidate.id === topologyId,
    );
    if (!target) continue;
    ids.add(target.ownerEntityId);
    for (const id of target.semanticTargetIds) ids.add(id);
  }
  const entities = interactionEntityMap(snapshot);
  return [...ids]
    .map((id) => entities.get(id))
    .filter((entity): entity is InteractionEntity => entity !== undefined);
}
