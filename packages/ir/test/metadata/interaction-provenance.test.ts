/**
 * @author Aidan Boissonneault
 * @file interaction-provenance.test.ts
 * @purpose Tests interaction provenance behavior in the metadata in IR package.
 * @last-edited October 6, 2026
 */

import {
  interactionId,
  renderedTargetsForEntity,
  sourceEntitiesForTarget,
  type InteractionSnapshot,
} from '../../src/index.js';
import { describe, expect, it } from 'vitest';

const span = {
  file: 'C:\\models\\part.bscd',
  line: 2,
  col: 1,
  endLine: 4,
  endCol: 2,
};

describe('interaction provenance contract', () => {
  it('normalizes path separators and includes instance paths in stable IDs', () => {
    const windows = interactionId('entity', span.file, span, 'body', 'loop:2');
    const slash = interactionId(
      'entity',
      'C:/models/part.bscd',
      { ...span, file: 'C:/models/part.bscd' },
      'body',
      'loop:2',
    );

    expect(windows).toBe(slash);
    expect(interactionId('entity', span.file, span, 'body', 'loop:3')).not.toBe(
      windows,
    );
  });

  it('traverses topology in both source-to-render and render-to-source directions', () => {
    const snapshot: InteractionSnapshot = {
      version: 1,
      entrypoint: span.file,
      entities: [
        {
          id: 'body',
          kind: 'object',
          name: 'body',
          declarationSpan: span,
          effectIds: [],
          rendered: true,
        },
        {
          id: 'top-face',
          kind: 'face',
          name: 'body.top',
          ownerId: 'body',
          declarationSpan: span,
          effectIds: [],
          rendered: true,
        },
      ],
      effects: [],
      references: [],
      topology: [
        {
          meshIndex: 0,
          partEntityId: 'part',
          objectEntityId: 'body',
          faces: [
            {
              id: 'face-geometry',
              ownerEntityId: 'body',
              semanticTargetIds: ['top-face'],
              triangleStart: 0,
              triangleCount: 2,
            },
          ],
          edges: [],
          corners: [],
        },
      ],
    };

    expect(renderedTargetsForEntity(snapshot, 'top-face')).toEqual([
      'face-geometry',
    ]);
    expect(
      sourceEntitiesForTarget(snapshot, 'face-geometry').map((e) => e.id),
    ).toEqual(['body', 'top-face']);
  });
});
