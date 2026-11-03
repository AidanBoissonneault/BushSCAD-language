/**
 * @author Aidan Boissonneault
 * @file atomic-region-arrangement.test.ts
 * @purpose Tests exact conic intersections used by atomic profile arrangement.
 * @last-edited November 3, 2026
 */

import type { IREllipseSegment, IRLineSegment } from '../../src/index.js';
import type { IRProfileLoop } from '../../src/geometry/profileRegions.js';
import { exactConicIntersections } from '../../src/geometry/atomic-region-arrangement.js';
import { describe, expect, it } from 'vitest';

describe('exact profile loop intersections', () => {
  it('returns null when neither loop contains an ellipse', () => {
    expect(
      exactConicIntersections(loop([line([-2, 0], [2, 0])]), loop([])),
    ).toBeNull();
  });

  it('collects ellipse crossings against line segments', () => {
    const intersections = exactConicIntersections(
      loop([ellipse([0, 0], 10, 5)]),
      loop([line([-20, 0], [20, 0])]),
    );

    expect(intersections).toEqual([
      [-10, 0],
      [10, 0],
    ]);
  });

  it('omits coincident conics that have no discrete crossing points', () => {
    const circle = ellipse([0, 0], 10, 5);
    expect(exactConicIntersections(loop([circle]), loop([{ ...circle }]))).toEqual(
      [],
    );
  });
});

/** Creates an ellipse segment for exact-intersection tests. */
function ellipse(
  center: [number, number],
  radiusX: number,
  radiusY: number,
): IREllipseSegment {
  const seam: [number, number] = [center[0] + radiusX, center[1]];
  return {
    kind: 'ellipse',
    name: 'ellipse',
    center,
    radiusX,
    radiusY,
    from: seam,
    to: seam,
    startAngle: 0,
    endAngle: Math.PI * 2,
    clockwise: false,
    full: true,
  };
}

/** Creates a line segment for exact-intersection tests. */
function line(from: [number, number], to: [number, number]): IRLineSegment {
  return { kind: 'line', name: 'line', from, to };
}

/** Creates a profile loop from the segments under test. */
function loop(segments: IRProfileLoop['segments']): IRProfileLoop {
  return {
    id: 'loop',
    segments,
    segmentNames: segments.map((segment) => segment.name),
    samplePoints: [],
    area: 0,
  };
}
