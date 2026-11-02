/**
 * @author Aidan Boissonneault
 * @file interaction-snapshot-validation.test.ts
 * @purpose Tests interaction snapshot validation behavior in the metadata in IR package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import {
  interactionSnapshotIssues,
  type InteractionSnapshot,
} from '../../src/index.js';

describe('interaction snapshot placement validation', () => {
  it('rejects face leakage and duplicated points for a singular placement', () => {
    const snapshot = fixture();

    expect(interactionSnapshotIssues(snapshot)).toEqual(
      expect.arrayContaining([
        'placement selector corner owns non-point topology',
        'placement selector corner has 2 reference points',
      ]),
    );
  });

  it('rejects invalid execution-time selector cardinality', () => {
    const base = fixture();
    const snapshot = {
      ...base,
      entities: base.entities.map((entity) =>
        entity.id === 'corner'
          ? { ...entity, collectionValueCount: Number.NaN }
          : entity,
      ),
    };

    expect(interactionSnapshotIssues(snapshot)).toContain(
      'selector corner has invalid collection value count',
    );
  });

  it('rejects empty or incomplete collection descriptions', () => {
    const base = fixture();
    const snapshot = {
      ...base,
      entities: base.entities.map((entity) =>
        entity.id === 'corner'
          ? {
              ...entity,
              collectionValueCount: 2,
              collectionValues: [''],
            }
          : entity,
      ),
    };

    expect(interactionSnapshotIssues(snapshot)).toEqual(
      expect.arrayContaining([
        'selector corner has an empty collection value',
        'selector corner has mismatched collection values',
      ]),
    );
  });
});

/**
 * Handles fixture in the metadata flow.
 */
function fixture(): InteractionSnapshot {
  const span = { file: 'part.bscd', line: 1, col: 1 };
  /**
   * Resolves the reference against its owning declaration.
   */
  const referencePoint = (id: string) => ({
    id,
    ownerEntityId: 'corner',
    semanticTargetIds: ['corner'],
    point: [1, 2, 3] as [number, number, number],
    role: 'reference-point' as const,
  });
  return {
    version: 1,
    entrypoint: span.file,
    entities: [
      {
        id: 'part',
        kind: 'part',
        name: 'part',
        declarationSpan: span,
        effectIds: [],
        rendered: true,
      },
      {
        id: 'corner',
        kind: 'corner',
        name: 'body.top.corner.front_right',
        declarationSpan: span,
        effectIds: [],
        selectorKind: 'named-corner',
        placement: { faceRef: 'body.top.corner.front_right' },
        rendered: false,
      },
    ],
    effects: [],
    references: [],
    topology: [
      {
        meshIndex: 0,
        partEntityId: 'part',
        faces: [
          {
            id: 'face',
            ownerEntityId: 'part',
            semanticTargetIds: ['corner'],
            triangleStart: 0,
            triangleCount: 2,
          },
        ],
        edges: [],
        corners: [referencePoint('point-a'), referencePoint('point-b')],
      },
    ],
  };
}
