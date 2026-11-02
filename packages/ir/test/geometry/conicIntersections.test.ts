/**
 * @author Aidan Boissonneault
 * @file conicIntersections.test.ts
 * @purpose Tests conic intersections behavior in the geometry in IR package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import type { IREllipseSegment, IRLineSegment } from '../../src/index.js';
import { intersectEllipseSegment } from '../../src/index.js';

/**
 * Creates ellipse geometry from its center and radii.
 */
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

/**
 * Creates line geometry from the supplied endpoints.
 */
function line(from: [number, number], to: [number, number]): IRLineSegment {
  return { kind: 'line', name: 'line', from, to };
}

describe('exact ellipse intersections', () => {
  it('finds line secants, tangencies, and misses', () => {
    const curve = ellipse([0, 0], 10, 5);
    expect(
      intersectEllipseSegment(curve, line([-20, 0], [20, 0])).intersections,
    ).toHaveLength(2);
    const tangent = intersectEllipseSegment(curve, line([-20, 5], [20, 5]));
    expect(tangent.intersections).toHaveLength(1);
    expect(tangent.intersections[0].tangent).toBe(true);
    expect(
      intersectEllipseSegment(curve, line([-20, 6], [20, 6])).intersections,
    ).toEqual([]);
  });

  it('finds four ellipse crossings and preserves tangencies', () => {
    const horizontal = ellipse([0, 0], 10, 6);
    const vertical = ellipse([0, 0], 6, 10);
    expect(
      intersectEllipseSegment(horizontal, vertical).intersections,
    ).toHaveLength(4);
    const tangent = intersectEllipseSegment(
      ellipse([0, 0], 10, 5),
      ellipse([20, 0], 10, 5),
    );
    expect(tangent.intersections).toHaveLength(1);
    expect(tangent.intersections[0].tangent).toBe(true);
  });

  it('classifies coincident ellipses without arbitrary points', () => {
    expect(
      intersectEllipseSegment(ellipse([2, -4], 12, 3), ellipse([2, -4], 12, 3)),
    ).toEqual({ relation: 'coincident', intersections: [] });
  });
});
