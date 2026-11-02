/**
 * @author Aidan Boissonneault
 * @file circularArcLoop.test.ts
 * @purpose Tests circular arc loop behavior in the geometry in IR package.
 * @last-edited October 6, 2026
 */

import { analyzeCircularArcLoop, type CircularArc } from '../../src/index.js';
import { describe, expect, it } from 'vitest';

describe('circular arc loop analysis', () => {
  it.each([
    [
      'two semicircles',
      arcs([
        [
          [10, 0],
          [-10, 0],
        ],
        [
          [-10, 0],
          [10, 0],
        ],
      ]),
    ],
    [
      'three unequal sweeps',
      arcs([
        [
          [10, 0],
          [0, 10],
        ],
        [
          [0, 10],
          [-10, 0],
        ],
        [
          [-10, 0],
          [10, 0],
        ],
      ]),
    ],
    [
      'four quadrants in shuffled order',
      [
        arc([-10, 0], [0, -10]),
        arc([10, 0], [0, 10]),
        arc([0, -10], [10, 0]),
        arc([0, 10], [-10, 0]),
      ],
    ],
    [
      'six arcs',
      arcs(
        loopPairs([
          [10, 0],
          [5, 8.660254037844386],
          [-5, 8.660254037844386],
          [-10, 0],
          [-5, -8.660254037844386],
          [5, -8.660254037844386],
        ]),
      ),
    ],
  ])('recognizes %s', (_name, input) => {
    const result = analyzeCircularArcLoop(input);
    expect(result).toMatchObject({ recognized: true, radius: 10 });
    if (result.recognized) {
      expect(result.center[0]).toBeCloseTo(0, 9);
      expect(result.center[1]).toBeCloseTo(0, 9);
    }
  });

  it('normalizes an individually reversed declaration', () => {
    const input = arcs(
      loopPairs([
        [10, 0],
        [0, 10],
        [-10, 0],
        [0, -10],
      ]),
    );
    input[1] = {
      ...input[1],
      from: input[1].to,
      to: input[1].from,
      clockwise: true,
    };

    expect(analyzeCircularArcLoop(input).recognized).toBe(true);
  });

  it('returns order-independent averaged geometry', () => {
    const input = [
      arc([10, 0], [0, 10]),
      { ...arc([0, 10], [-10, 0]), radius: 10.00000004 },
      arc([-10, 0], [0, -10]),
      arc([0, -10], [10, 0]),
    ];
    const first = analyzeCircularArcLoop(input);
    const shifted = analyzeCircularArcLoop([
      input[2],
      input[3],
      input[0],
      input[1],
    ]);

    expect(first).toMatchObject({ recognized: true });
    expect(shifted).toMatchObject({ recognized: true });
    if (first.recognized && shifted.recognized) {
      expect(shifted.center).toEqual(first.center);
      expect(shifted.radius).toBe(first.radius);
    }
  });

  it('preserves a fractional center at very large radius', () => {
    const center: [number, number] = [0.1234, 0.2345];
    const radius = 1e9;
    const points = [
      [center[0] + radius, center[1]],
      [center[0], center[1] + radius],
      [center[0] - radius, center[1]],
      [center[0], center[1] - radius],
    ] as [number, number][];
    const result = analyzeCircularArcLoop(
      loopPairs(points).map(([from, to]) => ({
        from,
        to,
        radius,
        clockwise: false,
      })),
      1e-6,
    );

    expect(result).toMatchObject({ recognized: true });
    if (result.recognized) {
      expect(result.center[0]).toBeCloseTo(center[0], 6);
      expect(result.center[1]).toBeCloseTo(center[1], 6);
    }
  });

  it('rejects a visible gap even when the radius is very large', () => {
    const radius = 1e9;
    const input = [
      { ...arc([radius, 0], [0, radius]), radius },
      { ...arc([0, radius], [-radius, 0]), radius },
      { ...arc([-radius, 0], [0, -radius]), radius },
      { ...arc([0, -radius + 0.5], [radius, 0]), radius },
    ];

    expect(analyzeCircularArcLoop(input, 1e-6).recognized).toBe(false);
  });

  it('reports an equal-radius loop with different centers', () => {
    const result = analyzeCircularArcLoop(
      arcs(
        loopPairs([
          [10, 0],
          [0, 10],
          [-9, 0],
          [0, -10],
        ]),
      ),
    );

    expect(result).toEqual({ recognized: false, reason: 'mixed-center' });
  });

  it.each([
    [
      'partial sweep',
      arcs([
        [
          [10, 0],
          [0, 10],
        ],
      ]),
    ],
    [
      'open gap',
      [
        arc([10, 0], [0, 10]),
        arc([0, 10], [-10, 0]),
        arc([-10, 0], [0, -10]),
        arc([0, -9], [10, 0]),
      ],
    ],
    [
      'mixed radii',
      [
        arc([10, 0], [0, 10]),
        { ...arc([0, 10], [-10, 0]), radius: 11 },
        arc([-10, 0], [0, -10]),
        arc([0, -10], [10, 0]),
      ],
    ],
    [
      'inconsistent winding',
      [
        arc([10, 0], [0, 10]),
        { ...arc([0, 10], [-10, 0]), clockwise: true },
        arc([-10, 0], [0, -10]),
        arc([0, -10], [10, 0]),
      ],
    ],
    [
      'repeated coverage',
      [
        arc([10, 0], [-10, 0]),
        arc([-10, 0], [10, 0]),
        arc([10, 0], [-10, 0]),
        arc([-10, 0], [10, 0]),
      ],
    ],
  ])('rejects %s', (_name, input) => {
    expect(analyzeCircularArcLoop(input).recognized).toBe(false);
  });
});

/**
 * Creates an arc from its center, radius, and angular limits.
 */
function arc(from: [number, number], to: [number, number]): CircularArc {
  return { from, to, radius: 10, clockwise: false };
}

/**
 * Handles arcs in the geometry flow.
 */
function arcs(pairs: [[number, number], [number, number]][]): CircularArc[] {
  return pairs.map(([from, to]) => arc(from, to));
}

/**
 * Handles loop pairs in the geometry flow.
 */
function loopPairs(
  points: [number, number][],
): [[number, number], [number, number]][] {
  return points.map((point, index) => [
    point,
    points[(index + 1) % points.length],
  ]);
}
