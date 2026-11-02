/**
 * @author Aidan Boissonneault
 * @file axis-alignment.test.ts
 * @purpose Tests axis alignment behavior in the constraints in sketch solver package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import { solve } from '../../src/core/solver.js';
import type { SolveInput, SolveResult } from '../../src/types/types.js';

/**
 * Handles points in the constraints flow.
 */
function points(result: SolveResult): Map<string, [number, number]> {
  if ('points' in result) return result.points;
  throw new Error(`Expected solved points, got ${result.kind}`);
}

describe('point-pair axis alignment', () => {
  it('aligns point Y for horizontal and X for vertical relationships', () => {
    const result = solve({
      points: [
        { name: 'anchor', x: 3, y: 4, fixed: true },
        { name: 'driven', x: 12, y: 17 },
      ],
      segments: [],
      constraints: [
        {
          kind: 'horizontal',
          target: 'driven',
          ref: 'anchor',
          spanLine: 1,
          spanCol: 1,
        },
        {
          kind: 'vertical',
          target: 'driven',
          ref: 'anchor',
          spanLine: 2,
          spanCol: 1,
        },
      ],
    });

    expect(result.ok).toBe(true);
    expect(points(result).get('driven')).toEqual([
      expect.closeTo(3, 7),
      expect.closeTo(4, 7),
    ]);
  });
});

describe('fixed driving segments', () => {
  it('keeps a fixed segment unchanged while solving an attached midpoint', () => {
    const input: SolveInput = {
      points: [
        { name: 'left', x: 10, y: 5 },
        { name: 'right', x: 30, y: 15 },
        { name: 'marker', x: -4, y: 22 },
      ],
      segments: [
        {
          kind: 'line',
          name: 'driver',
          from: { kind: 'point', name: 'left' },
          to: { kind: 'point', name: 'right' },
          fixed: true,
        },
      ],
      constraints: [
        {
          kind: 'midpoint',
          target: 'marker',
          ref: 'driver',
          spanLine: 1,
          spanCol: 1,
        },
      ],
    };

    const result = solve(input);
    expect(result.ok).toBe(true);
    expect(points(result).get('left')).toEqual([10, 5]);
    expect(points(result).get('right')).toEqual([30, 15]);
    expect(points(result).get('marker')).toEqual([
      expect.closeTo(20, 7),
      expect.closeTo(10, 7),
    ]);
  });

  it('keeps a fixed arc radius out of the solve variables', () => {
    const result = solve({
      points: [
        { name: 'start', x: 5, y: 0 },
        { name: 'end', x: 0, y: 5 },
      ],
      segments: [
        {
          kind: 'arc',
          name: 'quarter',
          from: { kind: 'point', name: 'start' },
          to: { kind: 'point', name: 'end' },
          radius: 5,
          clockwise: false,
          fixed: true,
        },
      ],
      constraints: [],
    });

    expect(result.ok).toBe(true);
    expect('radii' in result ? result.radii.get('quarter') : undefined).toBe(5);
  });
});
