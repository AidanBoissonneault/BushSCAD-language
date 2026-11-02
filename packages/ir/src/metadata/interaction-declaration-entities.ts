/**
 * @author Aidan Boissonneault
 * @file interaction-declaration-entities.ts
 * @purpose Provides interaction declaration entities behavior for the metadata in IR package.
 * @last-edited October 6, 2026
 */

import type { InteractionEntity } from './interaction-provenance.js';

/**
 * Selects the user-facing entities when compiler internals share a name span.
 * Inline sketches inherit their owning object declaration's name range. Object
 * and generated-instance entities are the authored result at that range, so
 * editor navigation and previews must not expose internal sketch names.
 */
export function preferredDeclarationEntities(
  candidates: readonly InteractionEntity[],
): InteractionEntity[] {
  const priority = Math.max(
    ...candidates.map((entity) => declarationPriority(entity.kind)),
  );
  return candidates.filter(
    (entity) => declarationPriority(entity.kind) === priority,
  );
}

/**
 * Handles declaration priority in the metadata flow.
 */
function declarationPriority(kind: InteractionEntity['kind']): number {
  if (
    kind === 'part' ||
    kind === 'object' ||
    kind === 'generated-instance' ||
    kind === 'surface' ||
    kind === 'imported'
  ) {
    return 2;
  }
  return kind === 'sketch' ? 1 : 0;
}
