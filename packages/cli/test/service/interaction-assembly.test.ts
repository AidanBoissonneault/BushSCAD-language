/**
 * @author Aidan Boissonneault
 * @file interaction-assembly.test.ts
 * @purpose Tests interaction assembly behavior in the service in cli package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import type { InteractionSnapshot } from '@bushscad/ir';
import { assembleInteractionSnapshots } from '../../src/service/parallel/interaction-assembly.js';

const span = { file: 'parts.bscd', line: 1, col: 1 };

/**
 * Handles snapshot in the service flow.
 */
function snapshot(
  renderedId?: string,
  meshIndex?: number,
): InteractionSnapshot {
  return {
    version: 1,
    entrypoint: span.file,
    entities: ['part:a', 'part:b'].map((id) => ({
      id,
      kind: 'part' as const,
      name: id.slice(5),
      declarationSpan: span,
      effectIds: [],
      rendered: id === renderedId,
    })),
    effects: [],
    references: [],
    topology:
      meshIndex === undefined
        ? []
        : [
            {
              meshIndex,
              partEntityId: renderedId as string,
              faces: [],
              edges: [],
              corners: [],
            },
          ],
  };
}

describe('parallel interaction assembly', () => {
  it('merges rendered identities and offsets topology by full mesh counts', () => {
    const source = snapshot();
    const result = assembleInteractionSnapshots(source, [
      { partName: 'a', snapshot: snapshot('part:a', 0), meshCount: 2 },
      { partName: 'b', snapshot: snapshot('part:b', 0), meshCount: 1 },
    ]);
    expect(result.entities.map((entity) => entity.rendered)).toEqual([
      true,
      true,
    ]);
    expect(result.topology.map((entry) => entry.meshIndex)).toEqual([0, 2]);
  });
});
