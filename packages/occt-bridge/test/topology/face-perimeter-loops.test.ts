/**
 * @author Aidan Boissonneault
 * @file face-perimeter-loops.test.ts
 * @purpose Tests face perimeter loops behavior in the topology in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import { selectSampledOuterLoopEdges } from '../../src/topology/face-perimeter-loops.js';

describe('sampled face perimeter loops', () => {
  it('keeps a closed circular edge as an outer perimeter edge', () => {
    const points = Array.from({ length: 33 }, (_, index) => {
      const angle = (index / 32) * Math.PI * 2;
      return [Math.cos(angle) * 10, Math.sin(angle) * 10] as [number, number];
    });

    expect(selectSampledOuterLoopEdges([{ edge: 'circle', points }])).toEqual([
      'circle',
    ]);
  });

  it('drops sampled inner loops from perimeter selection', () => {
    const outer = {
      edge: 'outer',
      points: [
        [-10, -10],
        [10, -10],
        [10, 10],
        [-10, 10],
        [-10, -10],
      ] as [number, number][],
    };
    const inner = {
      edge: 'inner',
      points: [
        [-2, -2],
        [2, -2],
        [2, 2],
        [-2, 2],
        [-2, -2],
      ] as [number, number][],
    };

    expect(selectSampledOuterLoopEdges([outer, inner])).toEqual(['outer']);
  });
});
