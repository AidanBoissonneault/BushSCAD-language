/**
 * @author Aidan Boissonneault
 * @file wrapGeometry.test.ts
 * @purpose Tests wrap geometry behavior in the geometry in IR package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import {
  wrapOutlinePoints,
  wrapProfileSegments,
  type WrapPoint,
} from '../../src/index.js';

const points: WrapPoint[] = [
  [-20, -10],
  [20, -10],
  [0, 0],
  [20, 10],
  [-20, 10],
];

describe('wrap geometry', () => {
  it('generates ordered, convex, concave, and smooth wrap profiles', () => {
    const ordered = wrapProfileSegments(
      wrapOutlinePoints(points, 'ordered'),
      'ordered',
      { rounded: 2 },
    );
    const convex = wrapProfileSegments(
      wrapOutlinePoints(points, 'convex'),
      'convex',
      { tolerance: 0.2 },
    );
    const concave = wrapProfileSegments(
      wrapOutlinePoints(points, 'concave'),
      'concave',
      {},
    );
    const smooth = wrapProfileSegments(
      wrapOutlinePoints(points, 'smooth'),
      'smooth',
      { tension: 0.4 },
    );

    expect(ordered).toHaveLength(17);
    expect(ordered.filter((segment) => segment.kind === 'arc')).toHaveLength(4);
    expect(convex).toHaveLength(32);
    expect(concave).toHaveLength(40);
    expect(smooth).toHaveLength(17);
    expect(convex.map((segment) => segment.name)[0]).toBe('convex_edge_1_1');
    expect(smooth.some((segment) => segment.name === 'smooth_round_1')).toBe(
      true,
    );
  });
});
