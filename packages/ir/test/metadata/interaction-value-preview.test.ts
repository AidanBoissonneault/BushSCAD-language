/**
 * @author Aidan Boissonneault
 * @file interaction-value-preview.test.ts
 * @purpose Tests interaction value preview behavior in the metadata in IR package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import {
  interactionSnapshotIssues,
  interactionValuePreview,
  type InteractionSnapshot,
} from '../../src/index.js';

describe('interaction value previews', () => {
  it('shows named selector-array members in stable source order', () => {
    expect(
      interactionValuePreview(
        snapshot(),
        ['top', 'bottom'],
        ['top-face', 'bottom-face'],
      ),
    ).toEqual({
      total: 2,
      values: ['body.top', 'body.bottom'],
      omitted: 0,
    });
  });

  it('indexes concrete values hidden by built-in topology selectors', () => {
    expect(
      interactionValuePreview(
        snapshot(),
        ['perimeter'],
        ['edge-0', 'edge-1', 'edge-2', 'edge-3'],
      ),
    ).toEqual({
      total: 4,
      values: [
        'body.top.perimeter[0]',
        'body.top.perimeter[1]',
        'body.top.perimeter[2]',
        'body.top.perimeter[3]',
      ],
      omitted: 0,
    });
  });

  it('caps large previews without losing the concrete total', () => {
    expect(
      interactionValuePreview(
        snapshot(),
        ['perimeter'],
        Array.from({ length: 20 }, (_, index) => `edge-${index}`),
        3,
      ),
    ).toEqual({
      total: 20,
      values: [
        'body.top.perimeter[0]',
        'body.top.perimeter[1]',
        'body.top.perimeter[2]',
      ],
      omitted: 17,
    });
  });

  it('uses execution-time membership after an operation replaces its edges', () => {
    const base = snapshot();
    const realized = {
      ...base,
      entities: base.entities.map((entry) =>
        entry.id === 'perimeter'
          ? { ...entry, collectionValueCount: 4 }
          : entry,
      ),
    };

    expect(
      interactionValuePreview(
        realized,
        ['perimeter'],
        Array.from({ length: 77 }, (_, index) => `final-edge-${index}`),
      ),
    ).toEqual({
      total: 4,
      values: [
        'body.top.perimeter[0]',
        'body.top.perimeter[1]',
        'body.top.perimeter[2]',
        'body.top.perimeter[3]',
      ],
      omitted: 0,
    });
  });

  it('prefers concrete topology descriptions over synthetic indices', () => {
    const base = snapshot();
    const described = {
      ...base,
      entities: base.entities.map((entry) =>
        entry.id === 'perimeter'
          ? {
              ...entry,
              collectionValueCount: 2,
              collectionValues: [
                'body.top.front_edge — line (0, 0, 1) → (4, 0, 1), length 4 mm',
                'body.top.back_edge — line (4, 3, 1) → (0, 3, 1), length 4 mm',
              ],
            }
          : entry,
      ),
    };

    expect(
      interactionValuePreview(described, ['perimeter'], ['final-edge']),
    ).toEqual({
      total: 2,
      values: [
        'body.top.front_edge — line (0, 0, 1) → (4, 0, 1), length 4 mm',
        'body.top.back_edge — line (4, 3, 1) → (0, 3, 1), length 4 mm',
      ],
      omitted: 0,
    });
  });

  it('does not expose physical face fragmentation as language values', () => {
    expect(
      interactionValuePreview(
        snapshot(),
        ['top'],
        ['top-fragment-0', 'top-fragment-1'],
      ),
    ).toBeNull();
  });

  it('uses authored array indices for generated objects and their selectors', () => {
    const base = snapshot();
    const generated = {
      ...base,
      entities: [
        ...base.entities,
        generatedEntity('pocket-a', 'pocket_4', 'pocket[0]'),
        generatedEntity('pocket-b', 'pocket_5', 'pocket[1]'),
        selectorEntity('corner-a', 'pocket_4', 'pocket-a'),
        selectorEntity('corner-b', 'pocket_5', 'pocket-b'),
      ],
    };

    expect(
      interactionValuePreview(
        generated,
        ['corner-a', 'corner-b'],
        ['point-a', 'point-b'],
      )?.values,
    ).toEqual([
      'pocket[0].top.corner.front_right',
      'pocket[1].top.corner.front_right',
    ]);
  });

  it('reports malformed IDs and topology buffers without rejecting meshes', () => {
    const malformed = snapshot();
    malformed.references[0]!.targetIds = ['missing'];
    malformed.topology[0]!.edges[0]!.points = [0, 1];

    expect(interactionSnapshotIssues(malformed)).toEqual(
      expect.arrayContaining([
        'reference selector references missing entity missing',
        'edge edge-0 has an invalid point buffer',
      ]),
    );
  });
});

/**
 * Handles snapshot in the metadata flow.
 */
function snapshot(): MutableSnapshot {
  return {
    version: 1,
    entrypoint: 'part.bscd',
    entities: [
      entity('part', 'part', 'part'),
      entity('body', 'object', 'body'),
      entity('top', 'face', 'body.top'),
      entity('bottom', 'face', 'body.bottom'),
      {
        ...entity('perimeter', 'edge', 'body.top.perimeter'),
        selectorKind: 'face-perimeter',
      },
    ],
    effects: [],
    references: [
      {
        id: 'selector',
        span: span(),
        groupSpan: span(),
        segments: [{ span: span(), targetIds: ['top', 'bottom'] }],
        targetIds: ['top', 'bottom'],
      },
    ],
    topology: [
      {
        meshIndex: 0,
        partEntityId: 'part',
        objectEntityId: 'body',
        faces: [],
        edges: [
          {
            id: 'edge-0',
            ownerEntityId: 'body',
            semanticTargetIds: ['perimeter'],
            points: [0, 0, 0, 1, 0, 0],
          },
        ],
        corners: [],
      },
    ],
  };
}

/**
 * Derives `MutableSnapshot` from `InteractionSnapshot & { references: Array<{ id: string; span:
 * ReturnType<typeof span>; groupSpan: ReturnType<typeof span>; segments: Array<{ span:
 * ReturnType<typeof span>; targetIds: string[]; }>; targetIds: string[]; }>; topology: Array<{
 * meshIndex: number; partEntityId: string; objectEntityId: string; faces: []; edges: Array<{ id:
 * string; ownerEntityId: string; semanticTargetIds: string[]; points: number[]; }>; corners: []; }>;
 * }` to preserve its type relationship in the metadata layer.
 */
type MutableSnapshot = InteractionSnapshot & {
  references: Array<{
    id: string;
    span: ReturnType<typeof span>;
    groupSpan: ReturnType<typeof span>;
    segments: Array<{
      span: ReturnType<typeof span>;
      targetIds: string[];
    }>;
    targetIds: string[];
  }>;
  topology: Array<{
    meshIndex: number;
    partEntityId: string;
    objectEntityId: string;
    faces: [];
    edges: Array<{
      id: string;
      ownerEntityId: string;
      semanticTargetIds: string[];
      points: number[];
    }>;
    corners: [];
  }>;
};

/**
 * Handles entity in the metadata flow.
 */
function entity(
  id: string,
  kind: 'part' | 'object' | 'face' | 'edge',
  name: string,
) {
  return {
    id,
    kind,
    name,
    declarationSpan: span(),
    effectIds: [],
    rendered: true,
  } as const;
}

/**
 * Handles generated entity in the metadata flow.
 */
function generatedEntity(id: string, name: string, instancePath: string) {
  return {
    ...entity(id, 'object', name),
    kind: 'generated-instance' as const,
    instancePath,
  };
}

/**
 * Handles selector entity in the metadata flow.
 */
function selectorEntity(id: string, ownerName: string, ownerId: string) {
  return {
    ...entity(id, 'face', `${ownerName}.top.corner.front_right`),
    kind: 'corner' as const,
    ownerId,
    selectorKind: 'named-corner' as const,
  };
}

/**
 * Handles span in the metadata flow.
 */
function span() {
  return { file: 'part.bscd', line: 1, col: 1, endLine: 1, endCol: 2 };
}
