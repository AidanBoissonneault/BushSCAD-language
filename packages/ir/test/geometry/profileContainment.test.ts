/**
 * @author Aidan Boissonneault
 * @file profileContainment.test.ts
 * @purpose Tests profile containment behavior in the geometry in IR package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import type { IRArcSegment } from '../../src/sketch/sketchIr.js';
import { pointInPolygon2d } from '../../src/geometry/profileRegions.js';
import { pointInProfileSegments } from '../../src/geometry/profileContainment.js';

const CIRCLE: IRArcSegment[] = [
  {
    kind: 'arc',
    name: 'q1',
    from: [10, 15],
    to: [-15, 40],
    radius: 25,
    clockwise: false,
  },
  {
    kind: 'arc',
    name: 'q2',
    from: [-15, 40],
    to: [-40, 15],
    radius: 25,
    clockwise: false,
  },
  {
    kind: 'arc',
    name: 'q3',
    from: [-40, 15],
    to: [-15, -10],
    radius: 25,
    clockwise: false,
  },
  {
    kind: 'arc',
    name: 'q4',
    from: [-15, -10],
    to: [10, 15],
    radius: 25,
    clockwise: false,
  },
];

describe('exact profile containment', () => {
  it('classifies a near-edge point using the true arc instead of sampled chords', () => {
    const point: [number, number] = [-0.174, 34.866];
    const sampledCircle = CIRCLE.flatMap((segment) => {
      if (segment.kind !== 'arc') return [];
      const center: [number, number] = [-15, 15];
      const start = Math.atan2(
        segment.from[1] - center[1],
        segment.from[0] - center[0],
      );
      return Array.from({ length: 7 }, (_, index): [number, number] => {
        const angle = start + (index * Math.PI) / 12;
        return [
          center[0] + Math.cos(angle) * 25,
          center[1] + Math.sin(angle) * 25,
        ];
      });
    });

    expect(pointInPolygon2d(point, sampledCircle)).toBe(false);
    expect(pointInProfileSegments(point, CIRCLE)).toBe(true);
    expect(pointInProfileSegments([0.3, 34.866], CIRCLE)).toBe(false);
  });

  it('includes points on line and arc boundaries', () => {
    expect(pointInProfileSegments([10, 15], CIRCLE)).toBe(true);
    expect(pointInProfileSegments([-15, 40], CIRCLE)).toBe(true);
  });

  it('supports clockwise arc loops', () => {
    const clockwise = [...CIRCLE].reverse().map(
      (segment): IRArcSegment => ({
        ...segment,
        from: segment.to,
        to: segment.from,
        clockwise: true,
      }),
    );

    expect(pointInProfileSegments([-0.174, 34.866], clockwise)).toBe(true);
    expect(pointInProfileSegments([0.3, 34.866], clockwise)).toBe(false);
  });
});
