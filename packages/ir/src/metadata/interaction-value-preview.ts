/**
 * @author Aidan Boissonneault
 * @file interaction-value-preview.ts
 * @purpose Provides interaction value preview behavior for the metadata in IR package.
 * @last-edited October 6, 2026
 */

import type {
  InteractionEntity,
  InteractionSnapshot,
} from './interaction-provenance.js';
import type { ResolvedSelectorKind } from '../references/resolved-selection.js';

const DEFAULT_PREVIEW_LIMIT = 12;

/**
 * Interaction value preview, including total, values, and omitted.
 */
export type InteractionValuePreview = {
  readonly total: number;
  readonly values: readonly string[];
  readonly omitted: number;
};

/** Formats expanded members as a readable Markdown list for editor hovers. */
export function formatInteractionValuePreview(
  preview: InteractionValuePreview,
): string {
  const values = preview.values.map((value) => `- \`${value}\``).join('\n');
  const omitted = preview.omitted > 0 ? `\n- … ${preview.omitted} more` : '';
  return `Expanded values (${preview.total}):\n${values}${omitted}`;
}

/**
 * Describes the concrete values hidden behind one compiler-backed source link.
 * Selector variables, wildcards, generated declarations, and built-in topology
 * selectors can look singular in source while resolving to an ordered array.
 * The immutable snapshot is the only trustworthy source for that expansion.
 */
export function interactionValuePreview(
  snapshot: InteractionSnapshot,
  entityIds: readonly string[],
  topologyIds: readonly string[],
  limit = DEFAULT_PREVIEW_LIMIT,
): InteractionValuePreview | null {
  const entities = new Map(
    snapshot.entities.map((entity) => [entity.id, entity]),
  );
  const linkedEntities = [...new Set(entityIds)]
    .map((id) => entities.get(id))
    .filter((entity) => entity !== undefined);
  const concreteTopologyIds = [...new Set(topologyIds)];
  const values =
    linkedEntities.length > 1
      ? disambiguatedEntityNames(
          linkedEntities.map((entity) => displayName(entity, entities)),
        )
      : linkedEntities.length === 1 &&
          selectorCollectionKind(linkedEntities[0]!.selectorKind) &&
          collectionValueCount(linkedEntities[0]!, concreteTopologyIds) > 1
        ? collectionValues(linkedEntities[0]!, entities, concreteTopologyIds)
        : [];
  if (values.length <= 1) return null;

  const safeLimit = Math.max(1, Math.floor(limit));
  return {
    total: values.length,
    values: values.slice(0, safeLimit),
    omitted: Math.max(0, values.length - safeLimit),
  };
}

/** Prefers concrete compiler descriptions while retaining legacy snapshots. */
function collectionValues(
  entity: InteractionEntity,
  entities: ReadonlyMap<string, InteractionEntity>,
  concreteTopologyIds: readonly string[],
): string[] {
  if (entity.collectionValues?.length) return [...entity.collectionValues];
  return Array.from(
    { length: collectionValueCount(entity, concreteTopologyIds) },
    (_, index) => `${displayName(entity, entities)}[${index}]`,
  );
}

/** Uses the compiler-recorded selection size before final topology fallback. */
function collectionValueCount(
  entity: InteractionEntity,
  concreteTopologyIds: readonly string[],
): number {
  return entity.collectionValueCount ?? concreteTopologyIds.length;
}

/**
 * Handles selector collection kind in the metadata flow.
 */
function selectorCollectionKind(
  kind: InteractionEntity['selectorKind'],
): boolean {
  return Boolean(kind && COLLECTION_SELECTOR_KINDS.has(kind));
}

const COLLECTION_SELECTOR_KINDS = new Set<ResolvedSelectorKind>([
  'sketch-boundary',
  'face-perimeter',
  'face-edges',
  'edge-intersection',
  'object-perimeter',
  'object-edges',
]);

/**
 * Handles display name in the metadata flow.
 */
function displayName(
  entity: InteractionEntity,
  entities: ReadonlyMap<string, InteractionEntity>,
): string {
  if (entity.kind === 'generated-instance') {
    return entity.instancePath ?? entity.name;
  }
  const owner = entity.ownerId ? entities.get(entity.ownerId) : undefined;
  if (!owner?.instancePath || owner.instancePath === owner.name) {
    return entity.name;
  }
  return entity.name === owner.name
    ? owner.instancePath
    : entity.name.startsWith(`${owner.name}.`)
      ? `${owner.instancePath}${entity.name.slice(owner.name.length)}`
      : entity.name;
}

/**
 * Handles disambiguated entity names in the metadata flow.
 */
function disambiguatedEntityNames(names: readonly string[]): string[] {
  const totals = new Map<string, number>();
  const seen = new Map<string, number>();
  for (const name of names) totals.set(name, (totals.get(name) ?? 0) + 1);
  return names.map((name) => {
    if ((totals.get(name) ?? 0) === 1) return name;
    const index = seen.get(name) ?? 0;
    seen.set(name, index + 1);
    return `${name}[${index}]`;
  });
}
