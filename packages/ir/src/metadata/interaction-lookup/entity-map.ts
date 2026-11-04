import type {
  InteractionEntity,
  InteractionSnapshot,
} from '../interaction-provenance.js';

/** Indexes a snapshot by stable entity ID for boundary consumers. */
export function interactionEntityMap(
  snapshot: InteractionSnapshot,
): ReadonlyMap<string, InteractionEntity> {
  return new Map(snapshot.entities.map((entity) => [entity.id, entity]));
}
