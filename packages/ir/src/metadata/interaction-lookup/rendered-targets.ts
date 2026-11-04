import type { InteractionSnapshot } from '../interaction-provenance.js';

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
