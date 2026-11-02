/**
 * @author Aidan Boissonneault
 * @file interaction-placement-bindings.test.ts
 * @purpose Tests interaction placement bindings behavior in the topology in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it, vi } from 'vitest';
import type { InteractionEntity, InteractionSnapshot } from '@bushscad/ir';
import { createInteractionTopologyBindings } from '../../src/topology/interaction-bindings.js';

describe('interaction placement bindings', () => {
  it('resolves exact face, side, and corner placements as visible points', () => {
    const faceHandle = {};
    const entities = [
      entity('top', 'face', 'body.top', [1, 2, 4]),
      entity('left', 'face', 'body.left', [-10, 2, 1]),
      entity('right', 'face', 'body.right', [10, 3, 1]),
      entity('corner', 'corner', 'body.top.corner.front_left', [-10, -5, 4]),
    ];
    const pointByRef = new Map(
      entities.map((candidate) => [
        candidate.placement!.faceRef,
        candidate.testPoint,
      ]),
    );
    const labels = {
      resolveAxis: vi.fn((_oc, placement: { faceRef: string }) =>
        axis(pointByRef.get(placement.faceRef)!),
      ),
      resolveSemanticFaceHandles: vi.fn(() => [faceHandle]),
    };
    const bindings = createInteractionTopologyBindings(
      {} as never,
      snapshot(entities),
      labels as never,
    );

    expect(bindings.referencePointsForFace(faceHandle)).toEqual(
      entities.map((candidate) => ({
        id: candidate.id,
        point: candidate.testPoint,
      })),
    );
    expect(bindings.referencePointsForFace({})).toEqual([]);
    expect(bindings.unmatchedReferencePoints()).toEqual([]);
    expect(bindings.faceIds(faceHandle)).toEqual([]);
    expect(labels.resolveAxis).toHaveBeenCalledTimes(4);
  });

  it('reports placements whose construction face is absent from final meshes', () => {
    const candidate = entity('center', 'face', 'cut.bottom.center', [0, 0, 0]);
    const labels = {
      resolveAxis: vi.fn(() => axis(candidate.testPoint)),
      resolveSemanticFaceHandles: vi.fn(() => [{}]),
    };
    const bindings = createInteractionTopologyBindings(
      {} as never,
      snapshot([candidate]),
      labels as never,
    );

    expect(bindings.referencePointsForFace({})).toEqual([]);
    expect(bindings.unmatchedReferencePoints()).toEqual([
      { id: candidate.id, point: candidate.testPoint },
    ]);
  });
});

/**
 * Derives `TestEntity` from `InteractionEntity & { testPoint: [number, number, number]; }` to preserve
 * its type relationship in the topology layer.
 */
type TestEntity = InteractionEntity & {
  testPoint: [number, number, number];
};

/**
 * Handles entity in the topology flow.
 */
function entity(
  id: string,
  kind: 'face' | 'corner',
  faceRef: string,
  testPoint: [number, number, number],
): TestEntity {
  return {
    id,
    kind,
    name: faceRef,
    declarationSpan: { file: 'part.bscd', line: 1, col: 1 },
    effectIds: [],
    placement: { faceRef },
    rendered: false,
    testPoint,
  };
}

/**
 * Handles snapshot in the topology flow.
 */
function snapshot(entities: InteractionEntity[]): InteractionSnapshot {
  return {
    version: 1,
    entrypoint: 'part.bscd',
    entities,
    effects: [],
    references: [],
    topology: [],
  };
}

/**
 * Builds the axis data required by the current operation.
 */
function axis(point: [number, number, number]) {
  return {
    Location: () => ({
      X: () => point[0],
      Y: () => point[1],
      Z: () => point[2],
      delete: vi.fn(),
    }),
    delete: vi.fn(),
  };
}
