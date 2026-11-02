/**
 * @author Aidan Boissonneault
 * @file interaction-operation-bindings.test.ts
 * @purpose Tests interaction operation bindings behavior in the topology in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it, vi } from 'vitest';
import type { InteractionSnapshot } from '@bushscad/ir';
import {
  cutResultEdgeHandles,
  cutResultFaceHandles,
  isCutResultEntity,
} from '../../src/topology/interaction-operation-bindings.js';

describe('interaction operation bindings', () => {
  it('identifies only direct subtractive outputs', () => {
    const snapshot = interactionSnapshot();

    expect(isCutResultEntity(snapshot, 'pocket')).toBe(true);
    expect(isCutResultEntity(snapshot, 'body')).toBe(false);
  });

  it('resolves the complete captured feature instead of one directional face', () => {
    /**
     * Handles in the current topology flow.
     */
    const handle = (id: string) => ({
      id,
      /**
       * Returns whether the input meets the `same` condition.
       */
      IsSame(other: { id: string }) {
        return other.id === id;
      },
    });
    const labels = {
      getFeatureFaceHandles: vi.fn(() => [handle('wall'), handle('floor')]),
      getFeatureEdgeHandles: vi.fn(() => [handle('rim'), handle('wall-floor')]),
    };

    expect(
      cutResultFaceHandles({} as never, labels as never, 'pocket'),
    ).toHaveLength(2);
    expect(
      cutResultEdgeHandles({} as never, labels as never, 'pocket'),
    ).toHaveLength(2);
    expect(labels.getFeatureFaceHandles).toHaveBeenCalledWith('pocket');
    expect(labels.getFeatureEdgeHandles).toHaveBeenCalledWith({}, 'pocket');
  });
});

/**
 * Builds the interaction data required by the current scene.
 */
function interactionSnapshot(): InteractionSnapshot {
  return {
    version: 1,
    entrypoint: 'part.bscd',
    entities: [],
    effects: [
      {
        id: 'extrude',
        kind: 'extrude',
        span: { file: 'part.bscd', line: 2, col: 1 },
        inputEntityIds: ['profile'],
        outputEntityIds: ['body'],
      },
      {
        id: 'cut',
        kind: 'cut',
        span: { file: 'part.bscd', line: 3, col: 1 },
        inputEntityIds: ['hole', 'body'],
        outputEntityIds: ['pocket'],
      },
    ],
    references: [],
    topology: [],
  };
}
