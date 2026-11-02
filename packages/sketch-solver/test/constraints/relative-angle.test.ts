/**
 * @author Aidan Boissonneault
 * @file relative-angle.test.ts
 * @purpose Tests relative angle behavior in the constraints in sketch solver package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import { solve } from '../../src/core/solver.js';
import type { SolveInput } from '../../src/types/types.js';

/**
 * Handles solved angle in the constraints flow.
 */
function solvedAngle(input: SolveInput, target: string): number {
  const result = solve(input);
  expect(result).toHaveProperty('points');
  if (!('points' in result)) return 0;
  const segment = input.segments.find((item) => item.name === target)!;
  const from =
    segment.from.kind === 'point'
      ? result.points.get(segment.from.name)!
      : [segment.from.x, segment.from.y];
  const to =
    segment.to.kind === 'point'
      ? result.points.get(segment.to.name)!
      : [segment.to.x, segment.to.y];
  return (Math.atan2(to[1] - from[1], to[0] - from[0]) * 180) / Math.PI;
}

/**
 * Handles angle input in the constraints flow.
 */
function angleInput(ref?: string): SolveInput {
  return {
    points: [
      { name: 'a', x: 0, y: 0, fixed: true },
      { name: 'b', x: 20, y: 0, fixed: true },
      { name: 'c', x: 30, y: 0, fixed: true },
      { name: 'd', x: 42, y: 16 },
    ],
    segments: [
      {
        kind: 'line',
        name: 'reference',
        from: { kind: 'point', name: 'a' },
        to: { kind: 'point', name: 'b' },
      },
      {
        kind: 'line',
        name: 'driven',
        from: { kind: 'point', name: 'c' },
        to: { kind: 'point', name: 'd' },
      },
    ],
    constraints: [
      { kind: 'length', target: 'driven', value: 20, spanLine: 1, spanCol: 1 },
      {
        kind: 'angle',
        target: 'driven',
        ref,
        value: 45,
        spanLine: 2,
        spanCol: 1,
      },
    ],
  };
}

describe('angle constraints', () => {
  it('interprets absolute angle values as degrees', () => {
    expect(solvedAngle(angleInput(), 'driven')).toBeCloseTo(45, 4);
  });

  it('solves the smaller relative angle between two segments', () => {
    expect(solvedAngle(angleInput('reference'), 'driven')).toBeCloseTo(45, 4);
  });
});
