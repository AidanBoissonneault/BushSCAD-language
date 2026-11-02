/**
 * @author Aidan Boissonneault
 * @file interaction-generated-source-links.test.ts
 * @purpose Tests interaction generated source links behavior in the metadata in IR package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import {
  interactionSourceLinkAt,
  type InteractionSnapshot,
  type SourceSpan,
} from '../../src/index.js';

const file = 'C:/models/generated-part.bscd';
const linkSpan = span(4, 7, 4, 11);

describe('generated interaction source links', () => {
  it('aggregates every generated object sharing one authored declaration', () => {
    expect(interactionSourceLinkAt(snapshot(), file, 4, 8)).toMatchObject({
      kind: 'declaration',
      entityIds: ['cut-a', 'cut-b'],
      topologyIds: ['cut-a-wall', 'cut-a-floor', 'cut-b-wall', 'cut-b-floor'],
    });
  });
});

/**
 * Handles snapshot in the metadata flow.
 */
function snapshot(): InteractionSnapshot {
  return {
    version: 1,
    entrypoint: file,
    entities: [
      inlineSketchEntity(),
      generatedEntity('cut-a'),
      generatedEntity('cut-b'),
    ],
    effects: [],
    references: [],
    topology: [
      {
        meshIndex: 0,
        partEntityId: 'part',
        faces: [
          face('cut-a-wall', 'cut-a'),
          face('cut-a-floor', 'cut-a'),
          face('cut-b-wall', 'cut-b'),
          face('cut-b-floor', 'cut-b'),
        ],
        edges: [],
        corners: [],
      },
    ],
  };
}

/**
 * Handles generated entity in the metadata flow.
 */
function generatedEntity(id: string) {
  return {
    id,
    kind: 'generated-instance' as const,
    name: id,
    declarationSpan: span(4, 3, 4, 30),
    linkSpan,
    effectIds: [],
    rendered: true,
  };
}

/**
 * Handles inline sketch entity in the metadata flow.
 */
function inlineSketchEntity() {
  return {
    id: 'inline-sketch',
    kind: 'sketch' as const,
    name: '__inline_cut_sketch_0',
    declarationSpan: span(4, 3, 4, 30),
    linkSpan,
    effectIds: [],
    rendered: true,
  };
}

/**
 * Resolves the face data required by the current selector.
 */
function face(id: string, ownerEntityId: string) {
  return {
    id,
    ownerEntityId,
    semanticTargetIds: [] as string[],
    triangleStart: 0,
    triangleCount: 1,
  };
}

/**
 * Handles span in the metadata flow.
 */
function span(
  line: number,
  col: number,
  endLine: number,
  endCol: number,
): SourceSpan {
  return { file, line, col, endLine, endCol };
}
