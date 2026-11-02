/**
 * @author Aidan Boissonneault
 * @file interaction-topology-id.test.ts
 * @purpose Tests interaction topology ID behavior in the topology in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import { interactionTopologyId } from '../../src/topology/interaction-topology-id.js';

describe('interaction topology identity', () => {
  it('does not depend on tessellation density or point order', () => {
    const sparse = [0, 0, 0, 10, 10, 0];
    const denseAndReversed = [10, 10, 0, 5, 5, 0, 0, 0, 0];

    expect(interactionTopologyId('body', 'face', sparse)).toBe(
      interactionTopologyId('body', 'face', denseAndReversed),
    );
  });

  it('keeps owners and topology kinds distinct', () => {
    const points = [0, 0, 0, 10, 10, 0];

    expect(interactionTopologyId('left', 'face', points)).not.toBe(
      interactionTopologyId('right', 'face', points),
    );
    expect(interactionTopologyId('left', 'face', points)).not.toBe(
      interactionTopologyId('left', 'edge', points),
    );
    expect(interactionTopologyId('left', 'corner', points)).not.toBe(
      interactionTopologyId('left', 'point', points),
    );
  });
});
