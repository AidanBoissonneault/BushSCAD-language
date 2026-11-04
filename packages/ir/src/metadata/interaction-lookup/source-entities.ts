import type {
  InteractionEntity,
  InteractionSnapshot,
} from '../interaction-provenance.js';
import { interactionEntityMap } from './entity-map.js';

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
