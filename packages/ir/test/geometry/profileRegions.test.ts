/**
 * @author Aidan Boissonneault
 * @file profileRegions.test.ts
 * @purpose Tests profile regions behavior in the geometry in IR package.
 * @last-edited October 6, 2026
 */

import {
  profileSegmentsAreClosed,
  type IRProfileSegment,
} from '../../src/index.js';
import { describe, expect, it } from 'vitest';

describe('profile segment closure', () => {
  it('accepts a shuffled full-circle arc loop', () => {
    expect(
      profileSegmentsAreClosed([
        arc('bottom-left', [-10, 0], [0, -10]),
        arc('top-right', [10, 0], [0, 10]),
        arc('bottom-right', [0, -10], [10, 0]),
        arc('top-left', [0, 10], [-10, 0]),
      ]),
    ).toBe(true);
  });

  it('rejects a shuffled arc chain with a gap', () => {
    expect(
      profileSegmentsAreClosed([
        arc('bottom-left', [-10, 0], [0, -10]),
        arc('top-right', [10, 0], [0, 10]),
        arc('bottom-right', [0, -9], [10, 0]),
        arc('top-left', [0, 10], [-10, 0]),
      ]),
    ).toBe(false);
  });
});

/**
 * Creates an arc from its center, radius, and angular limits.
 */
function arc(
  name: string,
  from: [number, number],
  to: [number, number],
): IRProfileSegment {
  return { kind: 'arc', name, from, to, radius: 10, clockwise: false };
}
