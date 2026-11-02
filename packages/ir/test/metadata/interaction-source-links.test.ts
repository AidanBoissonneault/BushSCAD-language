/**
 * @author Aidan Boissonneault
 * @file interaction-source-links.test.ts
 * @purpose Tests interaction source links behavior in the metadata in IR package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import {
  finalRenderedEntityIdsForEffect,
  interactionLinkedSpans,
  interactionObjectContextAt,
  interactionSourceLinkAt,
  type InteractionSnapshot,
  type SourceSpan,
} from '../../src/index.js';

const file = 'C:/models/part.bscd';
/**
 * Handles span in the metadata flow.
 */
const span = (
  line: number,
  col: number,
  endLine = line,
  endCol = col + 1,
): SourceSpan => ({ file, line, col, endLine, endCol });

const snapshot: InteractionSnapshot = {
  version: 1,
  entrypoint: file,
  entities: [
    entity('part', 'part', span(1, 1, 10, 2)),
    entity('profile', 'sketch', span(2, 3, 2, 32)),
    entity('body', 'object', span(2, 1, 8, 2)),
    entity('top', 'face', span(5, 10, 5, 18)),
    entity('left', 'edge', span(5, 20, 5, 29)),
    entity('corner', 'corner', span(5, 31, 5, 38)),
    entity('perimeter', 'edge', span(6, 10, 6, 25)),
    entity('cut-result', 'object', span(7, 3, 7, 24)),
    entity('result', 'object', span(9, 1, 9, 28)),
  ],
  effects: [
    {
      id: 'extrude-effect',
      kind: 'extrude',
      span: span(2, 15, 2, 31),
      inputEntityIds: ['profile'],
      outputEntityIds: ['body'],
    },
    {
      id: 'cut-effect',
      kind: 'cut',
      span: span(7, 3, 7, 24),
      inputEntityIds: ['body'],
      outputEntityIds: ['cut-result'],
    },
    {
      id: 'place-effect',
      kind: 'place',
      span: span(9, 1, 9, 28),
      inputEntityIds: ['body'],
      outputEntityIds: ['result'],
    },
  ],
  invocations: [
    {
      id: 'invocation-a',
      name: 'pedestal',
      span: span(11, 1, 11, 40),
      linkSpan: span(11, 7, 11, 15),
      entityIds: ['body'],
    },
    {
      id: 'invocation-b',
      name: 'pedestal',
      span: span(11, 1, 11, 40),
      linkSpan: span(11, 7, 11, 15),
      entityIds: ['result'],
    },
  ],
  references: [
    {
      id: 'wildcard-group',
      span: span(5, 10, 5, 38),
      groupSpan: span(5, 10, 5, 38),
      segments: [
        { span: span(5, 11, 5, 14), targetIds: ['top'] },
        { span: span(5, 21, 5, 25), targetIds: ['left'] },
        { span: span(5, 31, 5, 37), targetIds: ['corner'] },
      ],
      targetIds: ['top', 'left', 'corner'],
    },
    {
      id: 'perimeter-group',
      span: span(6, 10, 6, 25),
      groupSpan: span(6, 10, 6, 25),
      segments: [{ span: span(6, 16, 6, 25), targetIds: ['perimeter'] }],
      targetIds: ['perimeter'],
    },
  ],
  topology: [
    {
      meshIndex: 0,
      partEntityId: 'part',
      objectEntityId: 'result',
      faces: [
        target('body-face', 'body', ['top']),
        target('cut-face', 'cut-result'),
        target('result-face', 'result'),
      ],
      edges: [
        {
          id: 'left-edge',
          ownerEntityId: 'body',
          semanticTargetIds: ['left'],
          points: [],
        },
        {
          id: 'perimeter-edge',
          ownerEntityId: 'body',
          semanticTargetIds: ['perimeter'],
          points: [],
        },
      ],
      corners: [
        {
          id: 'corner-point',
          ownerEntityId: 'body',
          semanticTargetIds: ['corner'],
          point: [0, 0, 0],
        },
      ],
    },
  ],
  sketchDefinitions: [
    {
      id: 'profile-definition',
      entityIds: ['profile'],
      name: 'profile',
      sourceSpan: span(2, 3, 2, 32),
      revision: 1,
      primitive: { kind: 'rect', width: 20, height: 10 },
    },
  ],
  sketchInstances: [
    {
      id: 'profile-instance',
      definitionId: 'profile-definition',
      entityIds: ['profile'],
      partEntityId: 'part',
      partName: 'part',
      sourceSpan: span(2, 3, 2, 32),
      placement: null,
      workplane: 'XY',
      transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
    },
  ],
};

describe('interaction source links', () => {
  it('links selector members but leaves punctuation and whitespace unlinked', () => {
    expect(interactionSourceLinkAt(snapshot, file, 5, 12)).toMatchObject({
      kind: 'reference-member',
      topologyIds: ['body-face'],
    });
    expect(interactionSourceLinkAt(snapshot, file, 5, 18)).toBeNull();
    expect(interactionSourceLinkAt(snapshot, file, 5, 32)).toMatchObject({
      kind: 'reference-member',
      topologyIds: ['corner-point'],
    });
  });

  it('prefers an inner effect and follows it to final rendered outputs', () => {
    expect(finalRenderedEntityIdsForEffect(snapshot, 'cut-effect')).toEqual([
      'body',
      'cut-result',
      'result',
    ]);
    expect(interactionObjectContextAt(snapshot, file, 7, 10)).toMatchObject({
      kind: 'effect',
      topologyIds: ['cut-face'],
    });
  });

  it('aggregates repeated function instances at one authored call site', () => {
    expect(interactionSourceLinkAt(snapshot, file, 11, 10)).toMatchObject({
      kind: 'invocation',
      topologyIds: [
        'body-face',
        'left-edge',
        'perimeter-edge',
        'corner-point',
        'result-face',
      ],
    });
    expect(
      interactionObjectContextAt(snapshot, file, 11, 20)?.entityIds,
    ).toEqual(['body', 'result']);
  });

  it('keeps an object perimeter link restricted to perimeter edges', () => {
    expect(interactionSourceLinkAt(snapshot, file, 6, 20)).toMatchObject({
      kind: 'reference-member',
      topologyIds: ['perimeter-edge'],
    });
  });

  it('decorates only rendered declarations and references without duplicates', () => {
    const links = interactionLinkedSpans(snapshot, 'part.bscd');
    expect(links.some((link) => link.kind === 'reference-member')).toBe(true);
    expect(
      links.find((link) => link.entityIds.includes('part'))?.topologyIds,
    ).toContain('result-face');
    expect(
      links.find((link) => link.entityIds.includes('profile'))?.topologyIds,
    ).toEqual(['profile-definition', 'profile-instance']);
    expect(
      links.every((link) => {
        const width = (link.span.endCol ?? link.span.col) - link.span.col;
        const entityName = snapshot.entities.find(
          (entity) => entity.id === link.entityIds[0],
        )?.name;
        return (
          link.span.endLine === link.span.line &&
          (link.kind === 'declaration'
            ? width === entityName?.length
            : link.kind === 'invocation'
              ? width === 'pedestal'.length
              : width <= 'perimeter'.length)
        );
      }),
    ).toBe(true);
    expect(links.every((link) => link.topologyIds.length > 0)).toBe(true);
    expect(new Set(links.map((link) => JSON.stringify(link.span))).size).toBe(
      links.length,
    );
  });
});

/**
 * Handles entity in the metadata flow.
 */
function entity(
  id: string,
  kind: 'part' | 'sketch' | 'object' | 'face' | 'edge' | 'corner',
  declarationSpan: SourceSpan,
) {
  return {
    id,
    kind,
    name: id,
    declarationSpan,
    ...(!['face', 'edge', 'corner'].includes(kind)
      ? {
          linkSpan: span(
            declarationSpan.line,
            declarationSpan.col + 4,
            declarationSpan.line,
            declarationSpan.col + 4 + id.length,
          ),
        }
      : {}),
    effectIds: [],
    rendered: true,
  } as const;
}

/**
 * Handles target in the metadata flow.
 */
function target(
  id: string,
  ownerEntityId: string,
  semanticTargetIds: string[] = [],
) {
  return {
    id,
    ownerEntityId,
    semanticTargetIds,
    triangleStart: 0,
    triangleCount: 1,
  };
}
