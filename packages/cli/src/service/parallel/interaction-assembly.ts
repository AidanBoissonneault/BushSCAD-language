/**
 * @author Aidan Boissonneault
 * @file interaction-assembly.ts
 * @purpose Provides interaction assembly behavior for the service parallel in cli package.
 * @last-edited October 6, 2026
 */

import type {
  InteractionEntity,
  InteractionMeshTopology,
  InteractionSketchInstance,
  InteractionSnapshot,
} from '@bushscad/ir';

/** Reassembles per-part provenance in deterministic source/mesh order. */
export function assembleInteractionSnapshots(
  source: InteractionSnapshot,
  parts: readonly {
    partName: string;
    snapshot: InteractionSnapshot;
    meshCount: number;
  }[],
): InteractionSnapshot {
  const snapshots = parts.map((part) => part.snapshot);
  const topology: InteractionMeshTopology[] = [];
  let meshOffset = 0;
  for (const part of parts) {
    const snapshot = part.snapshot;
    topology.push(
      ...snapshot.topology.map((entry) => ({
        ...entry,
        meshIndex: entry.meshIndex + meshOffset,
      })),
    );
    meshOffset += part.meshCount;
  }
  return {
    ...source,
    entities: source.entities.map((entity) => mergeEntity(entity, snapshots)),
    topology,
    ...(source.sketchInstances
      ? { sketchInstances: mergeSketchInstances(source, snapshots) }
      : {}),
  };
}

/**
 * Handles merge entity in the service parallel flow.
 */
function mergeEntity(
  source: InteractionEntity,
  snapshots: readonly InteractionSnapshot[],
): InteractionEntity {
  const matches = snapshots
    .map((snapshot) =>
      snapshot.entities.find((entry) => entry.id === source.id),
    )
    .filter((entry): entry is InteractionEntity => Boolean(entry));
  const realized = lastRealizedEntity(matches);
  return {
    ...source,
    rendered: matches.some((entry) => entry.rendered),
    ...(realized?.collectionValueCount !== undefined
      ? { collectionValueCount: realized.collectionValueCount }
      : {}),
    ...(realized?.collectionValues
      ? { collectionValues: realized.collectionValues }
      : {}),
  };
}

/** Preserves classic source-order overwrite behavior for reused selection IDs. */
function lastRealizedEntity(
  matches: readonly InteractionEntity[],
): InteractionEntity | undefined {
  for (let index = matches.length - 1; index >= 0; index--) {
    const entry = matches[index];
    if (
      entry.rendered ||
      entry.collectionValueCount !== undefined ||
      entry.collectionValues !== undefined
    ) {
      return entry;
    }
  }
  return undefined;
}

/**
 * Handles merge sketch instances in the service parallel flow.
 */
function mergeSketchInstances(
  source: InteractionSnapshot,
  snapshots: readonly InteractionSnapshot[],
): InteractionSketchInstance[] {
  return (source.sketchInstances ?? []).map((instance) => {
    const realized = snapshots
      .flatMap((snapshot) => snapshot.sketchInstances ?? [])
      .find((entry) => entry.id === instance.id && entry.transform);
    return realized ?? instance;
  });
}
