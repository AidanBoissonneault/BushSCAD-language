/**
 * @author Aidan Boissonneault
 * @file sketch-instance-realization.test.ts
 * @purpose Tests sketch instance realization behavior in the topology in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it, vi } from 'vitest';
import type { InteractionSnapshot } from '@bushscad/ir';
import { realizeInteractionSketchInstances } from '../../src/topology/sketch-instance-realization.js';

describe('sketch instance realization', () => {
  it('converts the final placement axis and local loft offset to a matrix', () => {
    const axis = fakeAxis([10, 20, 30], [0, 1, 0], [0, 0, 1], [1, 0, 0]);
    const snapshot = realizeInteractionSketchInstances(
      {} as never,
      [
        {
          group: { name: 'plate' },
          labelMap: { resolveAxis: vi.fn(() => axis) },
        } as never,
      ],
      sourceSnapshot(),
    );

    expect(snapshot?.sketchInstances?.[0]?.transform).toEqual([
      0, 1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 12, 20, 30, 1,
    ]);
    expect(axis.delete).toHaveBeenCalledOnce();
  });

  it('retains an explicit diagnostic when placement realization fails', () => {
    const snapshot = realizeInteractionSketchInstances(
      {} as never,
      [
        {
          group: { name: 'plate' },
          labelMap: {
            resolveAxis: () => {
              throw new Error('missing face');
            },
          },
        } as never,
      ],
      sourceSnapshot(),
    );

    expect(snapshot?.sketchInstances?.[0]?.unsupportedReason).toContain(
      'missing face',
    );
  });
});

/**
 * Returns the source data required by the current operation.
 */
function sourceSnapshot(): InteractionSnapshot {
  return {
    version: 1,
    entrypoint: 'part.bscd',
    entities: [],
    effects: [],
    references: [],
    topology: [],
    sketchInstances: [
      {
        id: 'instance',
        definitionId: 'definition',
        entityIds: ['sketch'],
        partEntityId: 'part',
        partName: 'plate',
        sourceSpan: { file: 'part.bscd', line: 3, col: 3 },
        placement: { faceRef: 'body.top.center' },
        workplane: 'XY',
        localOffsetZ: 2,
      },
    ],
  };
}

/**
 * Handles fake axis in the topology flow.
 */
function fakeAxis(
  point: [number, number, number],
  x: [number, number, number],
  y: [number, number, number],
  z: [number, number, number],
) {
  return {
    Location: () => vector(point),
    XDirection: () => vector(x),
    YDirection: () => vector(y),
    Direction: () => vector(z),
    delete: vi.fn(),
  };
}

/**
 * Handles vector in the topology flow.
 */
function vector([x, y, z]: [number, number, number]) {
  return { X: () => x, Y: () => y, Z: () => z, delete: vi.fn() };
}
