/**
 * @author Aidan Boissonneault
 * @file interaction-entities.ts
 * @purpose Provides interaction entities behavior for the metadata in evaluator package.
 * @last-edited October 6, 2026
 */

import {
  interactionId,
  interactionSpanKey,
  type InteractionEntity,
  type InteractionEntityKind,
} from '@bushscad/ir';
import type { InteractionDeclarationSource } from './interaction-declarations.js';

/**
 * Derives `MutableInteractionEntity` from `Omit< InteractionEntity, 'effectIds' | 'instancePath' |
 * 'kind' > & { kind: InteractionEntityKind; effectIds: string[]; instancePath?: string; }` to preserve
 * its type relationship in the metadata layer.
 */
export type MutableInteractionEntity = Omit<
  InteractionEntity,
  'effectIds' | 'instancePath' | 'kind'
> & {
  kind: InteractionEntityKind;
  effectIds: string[];
  instancePath?: string;
};

/** Creates or reuses a semantic entity within its owning part scope. */
export function ensureInteractionEntity(
  entities: MutableInteractionEntity[],
  byName: Map<string, MutableInteractionEntity>,
  entrypoint: string,
  name: string,
  kind: InteractionEntityKind,
  source: InteractionDeclarationSource,
  ownerId?: string,
): MutableInteractionEntity {
  const key = scopedName(ownerId, name);
  const existing = byName.get(key);
  if (existing?.kind === kind) return existing;
  const entity: MutableInteractionEntity = {
    id: interactionId('entity', entrypoint, source.span, name, name),
    kind,
    name,
    ...(ownerId ? { ownerId } : {}),
    declarationSpan: source.span,
    ...(source.linkSpan ? { linkSpan: source.linkSpan } : {}),
    effectIds: [],
    instancePath: source.name ?? name,
    rendered: false,
  };
  entities.push(entity);
  byName.set(key, entity);
  return entity;
}

/** Looks up an entity locally first, then falls back to the global name. */
export function lookupInteractionEntity(
  entities: Map<string, MutableInteractionEntity>,
  name: string,
  ownerId?: string,
): MutableInteractionEntity | undefined {
  return entities.get(scopedName(ownerId, name)) ?? entities.get(name);
}

/** Preserves source order while removing repeated semantic entities. */
export function uniqueInteractionEntities(
  entities: MutableInteractionEntity[],
): MutableInteractionEntity[] {
  return entities.filter(
    (entity, index) =>
      entities.findIndex((other) => other.id === entity.id) === index,
  );
}

/**
 * Builds the interaction data required by the current scene.
 */
export function interactionEntityIds(
  entities: MutableInteractionEntity[],
): string[] {
  return [...new Set(entities.map((entity) => entity.id))];
}

/** Marks repeated unrolled object declarations as generated instances. */
export function markGeneratedInteractionInstances(
  entities: MutableInteractionEntity[],
): void {
  const groups = new Map<string, MutableInteractionEntity[]>();
  for (const entity of entities) {
    if (entity.kind !== 'object') continue;
    const key = interactionSpanKey(entity.declarationSpan);
    const group = groups.get(key) ?? [];
    group.push(entity);
    groups.set(key, group);
  }
  for (const group of groups.values()) {
    if (group.length <= 1) continue;
    group.forEach((entity, index) => {
      entity.kind = 'generated-instance';
      entity.instancePath = `${entity.instancePath ?? entity.name}[${index}]`;
    });
  }
}

/**
 * Handles scoped name in the metadata flow.
 */
function scopedName(ownerId: string | undefined, name: string): string {
  return ownerId ? `${ownerId}::${name}` : name;
}
