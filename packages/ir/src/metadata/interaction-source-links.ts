/**
 * @author Aidan Boissonneault
 * @file interaction-source-links.ts
 * @purpose Provides interaction source links behavior for the metadata in IR package.
 * @last-edited October 6, 2026
 */

import type { SourceSpan } from '../shared/ir-core.js';
import {
  renderedDownstreamEntityIds,
  renderedResultEntityIdsForEffect,
} from './interaction-effect-results.js';
export {
  finalRenderedEntityIdsForEffect,
  renderedResultEntityIdsForEffect,
} from './interaction-effect-results.js';
import {
  renderedOrOwnerTargetsForEntity,
  renderedTargetsForEntity,
} from './interaction-lookup.js';
import type {
  InteractionEffect,
  InteractionSnapshot,
} from './interaction-provenance.js';
import {
  deduplicateInteractionLinks,
  narrowestInteractionSpan as narrowestContaining,
  positionInInteractionSpan as positionInSpan,
  sameInteractionFile as sameFile,
  sameInteractionSpan as sameSpan,
} from './interaction-source-spans.js';
import { preferredDeclarationEntities } from './interaction-declaration-entities.js';

/**
 * Accepted values for interaction source link kind are 'reference-member', 'declaration',
 * 'invocation', and 'effect'.
 */
export type InteractionSourceLinkKind =
  | 'reference-member'
  | 'declaration'
  | 'invocation'
  | 'effect';

/**
 * Interaction source link, including operation kind, span, entity ids, and topology ids.
 */
export type InteractionSourceLink = {
  readonly kind: InteractionSourceLinkKind;
  readonly span: SourceSpan;
  readonly entityIds: readonly string[];
  readonly topologyIds: readonly string[];
};

/** Resolves the most specific compiler-backed source relationship at a position. */
export function interactionSourceLinkAt(
  snapshot: InteractionSnapshot,
  file: string,
  line: number,
  col: number,
): InteractionSourceLink | null {
  const reference = narrowestContaining(
    snapshot.references.filter((candidate) =>
      positionInSpan(file, line, col, candidate.groupSpan),
    ),
    (candidate) => candidate.groupSpan,
  );
  if (reference) {
    const member = narrowestContaining(
      reference.segments.filter((segment) =>
        positionInSpan(file, line, col, segment.span),
      ),
      (segment) => segment.span,
    );
    return member
      ? sourceLink(snapshot, 'reference-member', member.span, member.targetIds)
      : null;
  }

  const invocationCandidates = (snapshot.invocations ?? []).filter(
    (candidate) => positionInSpan(file, line, col, candidate.linkSpan),
  );
  const invocation = narrowestContaining(
    invocationCandidates,
    (candidate) => candidate.linkSpan,
  );
  if (invocation) {
    return sourceLink(
      snapshot,
      'invocation',
      invocation.linkSpan,
      invocationCandidates
        .filter((candidate) =>
          sameSpan(candidate.linkSpan, invocation.linkSpan),
        )
        .flatMap((candidate) => candidate.entityIds),
    );
  }

  const entityCandidates = snapshot.entities.filter(
    (candidate) =>
      candidate.linkSpan && positionInSpan(file, line, col, candidate.linkSpan),
  );
  const entity = narrowestContaining(
    entityCandidates,
    (candidate) => candidate.linkSpan!,
  );
  const preferred = entity?.linkSpan
    ? preferredDeclarationEntities(
        entityCandidates.filter(
          (candidate) =>
            candidate.linkSpan &&
            sameSpan(candidate.linkSpan, entity.linkSpan!),
        ),
      )
    : [];
  return entity?.linkSpan
    ? declarationSourceLink(
        snapshot,
        entity.linkSpan,
        preferred.map((candidate) => candidate.id),
      )
    : null;
}

/** Resolves the innermost object effect/declaration independently of references. */
export function interactionObjectContextAt(
  snapshot: InteractionSnapshot,
  file: string,
  line: number,
  col: number,
): InteractionSourceLink | null {
  const invocationCandidates = (snapshot.invocations ?? []).filter(
    (candidate) => positionInSpan(file, line, col, candidate.span),
  );
  const invocation = narrowestContaining(
    invocationCandidates,
    (candidate) => candidate.span,
  );
  if (invocation) {
    return sourceLink(
      snapshot,
      'invocation',
      invocation.span,
      invocationCandidates
        .filter((candidate) => sameSpan(candidate.span, invocation.span))
        .flatMap((candidate) => candidate.entityIds),
    );
  }
  const effectCandidates = snapshot.effects.filter((candidate) =>
    positionInSpan(file, line, col, candidate.span),
  );
  const effect = narrowestContaining(
    effectCandidates,
    (candidate) => candidate.span,
  );
  if (effect) {
    return effectsSourceLink(
      snapshot,
      effectCandidates.filter((candidate) =>
        sameSpan(candidate.span, effect.span),
      ),
    );
  }

  const entity = narrowestContaining(
    snapshot.entities.filter(
      (candidate) =>
        objectContextKind(candidate.kind) &&
        positionInSpan(file, line, col, candidate.declarationSpan),
    ),
    (candidate) => candidate.declarationSpan,
  );
  return entity
    ? sourceLink(snapshot, 'declaration', entity.declarationSpan, [entity.id])
    : null;
}

/** Lists decoration-worthy rendered declaration and reference ranges for a file. */
export function interactionLinkedSpans(
  snapshot: InteractionSnapshot,
  file: string,
): InteractionSourceLink[] {
  return deduplicateInteractionLinks([
    ...declarationLinksForFile(snapshot, file),
    ...invocationLinksForFile(snapshot, file),
    ...referenceLinksForFile(snapshot, file),
  ]);
}

/**
 * Handles declaration links for file in the metadata flow.
 */
function declarationLinksForFile(
  snapshot: InteractionSnapshot,
  file: string,
): InteractionSourceLink[] {
  const links: InteractionSourceLink[] = [];
  for (const entity of snapshot.entities) {
    if (!entity.linkSpan || !sameFile(file, entity.linkSpan.file)) continue;
    const link = declarationSourceLink(snapshot, entity.linkSpan, [entity.id]);
    if (link.topologyIds.length > 0) links.push(link);
  }
  return links;
}

/**
 * Handles invocation links for file in the metadata flow.
 */
function invocationLinksForFile(
  snapshot: InteractionSnapshot,
  file: string,
): InteractionSourceLink[] {
  const links: InteractionSourceLink[] = [];
  for (const invocation of snapshot.invocations ?? []) {
    if (!sameFile(file, invocation.linkSpan.file)) continue;
    const link = sourceLink(
      snapshot,
      'invocation',
      invocation.linkSpan,
      invocation.entityIds,
    );
    if (link.topologyIds.length > 0) links.push(link);
  }
  return links;
}

/**
 * Resolves the reference against its owning declaration.
 */
function referenceLinksForFile(
  snapshot: InteractionSnapshot,
  file: string,
): InteractionSourceLink[] {
  const links: InteractionSourceLink[] = [];
  for (const reference of snapshot.references) {
    if (!sameFile(file, reference.groupSpan.file)) continue;
    for (const segment of reference.segments) {
      const link = sourceLink(
        snapshot,
        'reference-member',
        segment.span,
        segment.targetIds,
      );
      if (link.topologyIds.length > 0) links.push(link);
    }
  }
  return links;
}

/**
 * Handles declaration source link in the metadata flow.
 */
function declarationSourceLink(
  snapshot: InteractionSnapshot,
  span: SourceSpan,
  entityIds: readonly string[],
): InteractionSourceLink {
  const entities = snapshot.entities.filter((candidate) =>
    entityIds.includes(candidate.id),
  );
  if (entities.every((entity) => entity.kind === 'sketch')) {
    return sourceLink(snapshot, 'declaration', span, entityIds);
  }
  const renderedIds = renderedDownstreamEntityIds(snapshot, entityIds);
  return {
    kind: 'declaration',
    span,
    entityIds: [...new Set(entityIds)],
    topologyIds: [
      ...new Set(
        renderedIds.flatMap((id) => renderedTargetsForEntity(snapshot, id)),
      ),
    ],
  };
}

/**
 * Handles effects source link in the metadata flow.
 */
function effectsSourceLink(
  snapshot: InteractionSnapshot,
  effects: readonly InteractionEffect[],
): InteractionSourceLink {
  const effect = effects[0]!;
  return sourceLink(
    snapshot,
    'effect',
    effect.span,
    effects.flatMap((candidate) =>
      renderedResultEntityIdsForEffect(snapshot, candidate.id),
    ),
  );
}

/**
 * Returns the source data required by the current operation.
 */
function sourceLink(
  snapshot: InteractionSnapshot,
  kind: InteractionSourceLinkKind,
  span: SourceSpan,
  entityIds: readonly string[],
): InteractionSourceLink {
  const uniqueEntityIds = [...new Set(entityIds)];
  return {
    kind,
    span,
    entityIds: uniqueEntityIds,
    topologyIds: [
      ...new Set(
        uniqueEntityIds.flatMap((id) =>
          renderedOrOwnerTargetsForEntity(snapshot, id),
        ),
      ),
    ],
  };
}

/**
 * Handles object context kind in the metadata flow.
 */
function objectContextKind(kind: string): boolean {
  return (
    kind === 'object' || kind === 'generated-instance' || kind === 'imported'
  );
}
