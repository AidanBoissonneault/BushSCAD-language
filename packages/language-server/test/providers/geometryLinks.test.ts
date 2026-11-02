/**
 * @author Aidan Boissonneault
 * @file geometryLinks.test.ts
 * @purpose Tests geometry links behavior in the providers in language server package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import type { InteractionSnapshot, SourceSpan } from '@bushscad/ir';
import {
  geometryDefinition,
  geometryLinkAtPosition,
  geometryReferences,
} from '../../src/providers/geometryLinks.js';

const main = '/project/main.bscd';
const library = '/project/library.bscd';
/**
 * Returns the source data required by the current operation.
 */
const sourceSpan = (
  file: string,
  line: number,
  col: number,
  endCol: number,
): SourceSpan => ({
  file,
  line,
  col,
  endLine: line,
  endCol,
});

const snapshot: InteractionSnapshot = {
  version: 1,
  entrypoint: main,
  entities: [
    entity('library-body', 'body', sourceSpan(library, 1, 1, 25)),
    entity('main-body', 'body', sourceSpan(main, 1, 1, 28)),
    entity('main-top', 'body.top', sourceSpan(main, 2, 7, 15)),
  ],
  effects: [],
  references: [
    {
      id: 'top-ref',
      span: sourceSpan(main, 2, 7, 15),
      groupSpan: sourceSpan(main, 2, 7, 15),
      segments: [
        { span: sourceSpan(main, 2, 12, 15), targetIds: ['main-top'] },
      ],
      targetIds: ['main-top'],
    },
  ],
  topology: [
    {
      meshIndex: 0,
      partEntityId: 'part',
      objectEntityId: 'main-body',
      faces: [
        {
          id: 'top-face',
          ownerEntityId: 'main-body',
          semanticTargetIds: ['main-top'],
          triangleStart: 0,
          triangleCount: 2,
        },
      ],
      edges: [],
      corners: [],
    },
  ],
};

describe('resolver-backed geometry links', () => {
  it('exposes stable semantic and topology identities', () => {
    expect(
      geometryLinkAtPosition(snapshot, main, { line: 2, col: 13 }),
    ).toMatchObject({
      kind: 'reference-member',
      entityIds: ['main-top'],
      topologyIds: ['top-face'],
    });
  });

  it('navigates definitions and references by ID despite duplicate names', () => {
    expect(geometryDefinition(snapshot, main, { line: 1, col: 8 })).toEqual({
      uri: 'file:///project/main.bscd',
      range: {
        start: { line: 1, col: 5 },
        end: { line: 1, col: 9 },
      },
    });
    expect(geometryReferences(snapshot, main, { line: 2, col: 13 })).toEqual([
      {
        uri: 'file:///project/main.bscd',
        range: {
          start: { line: 2, col: 12 },
          end: { line: 2, col: 15 },
        },
      },
    ]);
  });
});

/**
 * Handles entity in the providers flow.
 */
function entity(id: string, name: string, declarationSpan: SourceSpan) {
  const kind = id === 'main-top' ? ('face' as const) : ('object' as const);
  return {
    id,
    kind,
    name,
    declarationSpan,
    ...(kind === 'object'
      ? {
          linkSpan: sourceSpan(
            declarationSpan.file,
            declarationSpan.line,
            5,
            9,
          ),
        }
      : {}),
    effectIds: [],
    rendered: true,
  };
}
