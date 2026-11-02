/**
 * @author Aidan Boissonneault
 * @file interaction-snapshots.ts
 * @purpose Tests interaction snapshots behavior in the fixtures in language server package.
 * @last-edited October 6, 2026
 */

import type { InteractionSnapshot } from '@bushscad/ir';

/** Snapshot for an authored selector variable expanded into two edge sets. */
export function selectorArrayInteraction(): InteractionSnapshot {
  const span = {
    file: '/project/main.bscd',
    line: 2,
    col: 14,
    endLine: 2,
    endCol: 19,
  };
  /**
   * Handles entity in the fixtures flow.
   */
  const entity = (id: string, name: string) => ({
    id,
    kind: 'edge' as const,
    name,
    declarationSpan: span,
    effectIds: [],
    rendered: true,
  });
  return {
    version: 1,
    entrypoint: '/project/main.bscd',
    entities: [
      entity('top-edges', 'body.top.edges'),
      entity('bottom-edges', 'body.bottom.edges'),
    ],
    effects: [],
    references: [
      {
        id: 'sides',
        span,
        groupSpan: span,
        segments: [{ span, targetIds: ['top-edges', 'bottom-edges'] }],
        targetIds: ['top-edges', 'bottom-edges'],
      },
    ],
    topology: [
      {
        meshIndex: 0,
        partEntityId: 'part',
        faces: [],
        edges: [
          {
            id: 'top-edge',
            ownerEntityId: 'body',
            semanticTargetIds: ['top-edges'],
            points: [],
          },
          {
            id: 'bottom-edge',
            ownerEntityId: 'body',
            semanticTargetIds: ['bottom-edges'],
            points: [],
          },
        ],
        corners: [],
      },
    ],
  };
}
