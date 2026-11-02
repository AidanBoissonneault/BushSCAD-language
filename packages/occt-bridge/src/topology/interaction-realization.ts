/**
 * @author Aidan Boissonneault
 * @file interaction-realization.ts
 * @purpose Provides interaction realization behavior for the topology in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

import type {
  InteractionMeshTopology,
  InteractionSnapshot,
} from '@bushscad/ir';

/** Marks semantic records rendered and attaches realized mesh topology. */
export function realizeInteractionSnapshot(
  snapshot: InteractionSnapshot | undefined,
  topology: readonly InteractionMeshTopology[],
  selectionCounts: ReadonlyMap<string, number> = new Map(),
  selectionValues: ReadonlyMap<string, readonly string[]> = new Map(),
): InteractionSnapshot | undefined {
  if (!snapshot) return undefined;
  const renderedIds = new Set<string>();
  for (const mesh of topology) {
    renderedIds.add(mesh.partEntityId);
    if (mesh.objectEntityId) renderedIds.add(mesh.objectEntityId);
    for (const target of [...mesh.faces, ...mesh.edges, ...mesh.corners]) {
      renderedIds.add(target.ownerEntityId);
      for (const id of target.semanticTargetIds) renderedIds.add(id);
    }
  }
  for (const instance of snapshot.sketchInstances ?? []) {
    if (!instance.transform) continue;
    instance.entityIds.forEach((id) => renderedIds.add(id));
    renderedIds.add(instance.partEntityId);
  }
  return {
    ...snapshot,
    entities: snapshot.entities.map((entity) => ({
      ...entity,
      ...(entity.selectionId && selectionCounts.has(entity.selectionId)
        ? {
            collectionValueCount: selectionCounts.get(entity.selectionId),
          }
        : {}),
      ...(entity.selectionId && selectionValues.has(entity.selectionId)
        ? { collectionValues: selectionValues.get(entity.selectionId) }
        : {}),
      rendered: renderedIds.has(entity.id),
    })),
    topology,
  };
}
