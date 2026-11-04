/**
 * @author Aidan Boissonneault
 * @file interaction-effect-results.ts
 * @purpose Provides interaction effect results behavior for the metadata in IR package.
 * @last-edited October 6, 2026
 */

import { renderedTargetsForEntity } from './interaction-lookup/rendered-targets.js';
import type { InteractionSnapshot } from './interaction-provenance.js';

/** Follows an operation's dependency outputs to all currently rendered entities. */
export function finalRenderedEntityIdsForEffect(
  snapshot: InteractionSnapshot,
  effectId: string,
): string[] {
  const effect = snapshot.effects.find(
    (candidate) => candidate.id === effectId,
  );
  if (!effect) return [];
  return renderedDownstreamEntityIds(snapshot, [
    ...effect.inputEntityIds,
    ...effect.outputEntityIds,
  ]);
}

/** Returns only one operation's concrete rendered outputs, without propagation. */
export function renderedResultEntityIdsForEffect(
  snapshot: InteractionSnapshot,
  effectId: string,
): string[] {
  const effect = snapshot.effects.find(
    (candidate) => candidate.id === effectId,
  );
  return effect
    ? [...new Set(effect.outputEntityIds)].filter(
        (id) => renderedTargetsForEntity(snapshot, id).length > 0,
      )
    : [];
}

/** Finds rendered descendants so declarations follow later object operations. */
export function renderedDownstreamEntityIds(
  snapshot: InteractionSnapshot,
  seedIds: readonly string[],
): string[] {
  const affected = new Set(seedIds);
  let changed = true;
  while (changed) {
    changed = false;
    for (const candidate of snapshot.effects) {
      if (!candidate.inputEntityIds.some((id) => affected.has(id))) continue;
      for (const id of candidate.outputEntityIds) {
        if (affected.has(id)) continue;
        affected.add(id);
        changed = true;
      }
    }
  }
  return [...affected].filter(
    (id) => renderedTargetsForEntity(snapshot, id).length > 0,
  );
}
