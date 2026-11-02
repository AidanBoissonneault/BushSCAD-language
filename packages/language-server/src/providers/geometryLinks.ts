/**
 * @author Aidan Boissonneault
 * @file geometryLinks.ts
 * @purpose Provides geometry links behavior for the providers in language server package.
 * @last-edited October 6, 2026
 */

import {
  interactionSourceLinkAt,
  type InteractionSnapshot,
  type SourceSpan,
} from '@bushscad/ir';
import type {
  LanguageGeometryLink,
  LanguageLocation,
  LanguagePosition,
} from '../protocol/ILanguageServer.js';
import { uriFromPath } from '../language/uri.js';

/** Returns compiler-backed semantic and rendered identities at a source position. */
export function geometryLinkAtPosition(
  snapshot: InteractionSnapshot,
  filePath: string,
  position: LanguagePosition,
): LanguageGeometryLink | null {
  const link = interactionSourceLinkAt(
    snapshot,
    filePath,
    position.line,
    position.col,
  );
  return link
    ? {
        kind: link.kind,
        range: spanRange(link.span),
        entityIds: link.entityIds,
        topologyIds: link.topologyIds,
      }
    : null;
}

/** Resolves a geometry link to its stable semantic declaration. */
export function geometryDefinition(
  snapshot: InteractionSnapshot,
  filePath: string,
  position: LanguagePosition,
): LanguageLocation | null {
  const link = interactionSourceLinkAt(
    snapshot,
    filePath,
    position.line,
    position.col,
  );
  if (!link) return null;
  if (link.kind === 'reference-member') return spanLocation(link.span);
  const entity = link.entityIds
    .map((id) => snapshot.entities.find((candidate) => candidate.id === id))
    .find((candidate) => candidate !== undefined);
  return entity
    ? spanLocation(entity.linkSpan ?? entity.declarationSpan)
    : null;
}

/** Finds declarations and selector references sharing stable semantic IDs. */
export function geometryReferences(
  snapshot: InteractionSnapshot,
  filePath: string,
  position: LanguagePosition,
): LanguageLocation[] | null {
  const link = interactionSourceLinkAt(
    snapshot,
    filePath,
    position.line,
    position.col,
  );
  if (!link) return null;
  const ids = new Set(link.entityIds);
  const locations: LanguageLocation[] = [];
  for (const entity of snapshot.entities) {
    if (ids.has(entity.id) && entity.linkSpan) {
      locations.push(spanLocation(entity.linkSpan));
    }
  }
  for (const reference of snapshot.references) {
    for (const segment of reference.segments) {
      if (segment.targetIds.some((id) => ids.has(id))) {
        locations.push(spanLocation(segment.span));
      }
    }
  }
  return deduplicateLocations(locations);
}

/**
 * Handles span location in the providers flow.
 */
function spanLocation(span: SourceSpan): LanguageLocation {
  return { uri: uriFromPath(span.file), range: spanRange(span) };
}

/**
 * Handles span range in the providers flow.
 */
function spanRange(span: SourceSpan): LanguageLocation['range'] {
  return {
    start: { line: span.line, col: span.col },
    end: {
      line: span.endLine ?? span.line,
      col: span.endCol ?? span.col,
    },
  };
}

/**
 * Handles deduplicate locations in the providers flow.
 */
function deduplicateLocations(
  locations: LanguageLocation[],
): LanguageLocation[] {
  const seen = new Set<string>();
  return locations.filter((location) => {
    const { start, end } = location.range;
    const key = `${location.uri}:${start.line}:${start.col}:${end.line}:${end.col}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
