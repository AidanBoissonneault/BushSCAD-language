/**
 * @author Aidan Boissonneault
 * @file solver-rank-and-dimensions.test.ts
 * @purpose Tests solver rank and dimensions behavior in the core in sketch solver package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import { solve } from '../../src/core/solver.js';
import type { SolveInput, SolveResult } from '../../src/types/types.js';

/**
 * Handles geometry in the core flow.
 */
function geometry(result: SolveResult) {
  if (!('points' in result))
    throw new Error(`Expected geometry, got ${result.kind}`);
  return result;
}

describe('solver rank and live dimensions', () => {
  it('removes fixed constraint points before variable indexing', () => {
    const result = solve({
      points: [
        { name: 'a', x: 0, y: 0 },
        { name: 'b', x: 8, y: 1 },
      ],
      segments: [line('edge', 'a', 'b')],
      constraints: [
        constraint('fixed', 'a'),
        constraint('horizontal', 'edge'),
        { ...constraint('length', 'edge'), value: 12 },
      ],
    });

    expect(result.ok).toBe(true);
    expect(geometry(result).points.get('a')).toEqual([0, 0]);
    expect(geometry(result).points.get('b')?.[0]).toBeCloseTo(12, 5);
  });

  it('fixes both endpoints when a segment is the fixed target', () => {
    const result = solve({
      points: [
        { name: 'a', x: 2, y: 3 },
        { name: 'b', x: 11, y: 7 },
      ],
      segments: [line('edge', 'a', 'b')],
      constraints: [constraint('fixed', 'edge')],
    });

    expect(result.ok).toBe(true);
    expect(geometry(result).points.get('a')).toEqual([2, 3]);
    expect(geometry(result).points.get('b')).toEqual([11, 7]);
  });

  it('uses Jacobian rank for DOF and reports participating free points', () => {
    const result = solve({
      points: [
        { name: 'a', x: 0, y: 0 },
        { name: 'b', x: 10, y: 1 },
      ],
      segments: [line('edge', 'a', 'b')],
      constraints: [
        constraint('horizontal', 'edge'),
        constraint('horizontal', 'edge'),
      ],
    });

    expect(result).toMatchObject({ kind: 'underconstrained', dof: 3 });
    if (!result.ok && result.kind === 'underconstrained') {
      expect(result.freeNames).toEqual(expect.arrayContaining(['a', 'b']));
    }
  });

  it('solves midpoint, radius, diameter, and axis-relative angles', () => {
    const result = solve({
      points: [
        { name: 'a', x: 0, y: 0, fixed: true },
        { name: 'b', x: 20, y: 0, fixed: true },
        { name: 'middle', x: 8, y: 3 },
        { name: 'axis_end', x: 4, y: 8 },
      ],
      segments: [
        line('base', 'a', 'b'),
        line('axis_line', 'a', 'axis_end'),
        {
          kind: 'arc',
          name: 'curve',
          from: { kind: 'point', name: 'a' },
          to: { kind: 'point', name: 'b' },
          radius: 11,
          clockwise: false,
        },
      ],
      constraints: [
        { ...constraint('midpoint', 'middle'), ref: 'base' },
        { ...constraint('angle', 'axis_line'), ref: 'origin.y_axis', value: 0 },
        { ...constraint('length', 'axis_line'), value: 8 },
        { ...constraint('diameter', 'curve'), value: 24 },
      ],
    });

    expect(result.ok).toBe(true);
    expect(geometry(result).points.get('middle')?.[0]).toBeCloseTo(10, 5);
    expect(geometry(result).points.get('middle')?.[1]).toBeCloseTo(0, 5);
    expect(geometry(result).points.get('axis_end')?.[0]).toBeCloseTo(0, 5);
    expect(
      Math.abs(geometry(result).points.get('axis_end')?.[1] ?? 0),
    ).toBeCloseTo(8, 5);
    expect(geometry(result).radii.get('curve')).toBeCloseTo(12, 5);
  });

  it('evaluates named dimension measurements during each iteration', () => {
    const input: SolveInput = {
      points: [
        { name: 'a', x: 0, y: 0, fixed: true },
        { name: 'b', x: 10, y: 0, fixed: true },
        { name: 'c', x: 0, y: 5, fixed: true },
        { name: 'd', x: 12, y: 6 },
      ],
      segments: [line('reference', 'a', 'b'), line('driven', 'c', 'd')],
      dimensions: [
        { name: 'reference_length', dimension: 'length', target: 'reference' },
      ],
      constraints: [
        constraint('horizontal', 'driven'),
        {
          ...constraint('length', 'driven'),
          value: {
            kind: 'binary',
            op: '*',
            left: { kind: 'dimension', name: 'reference_length' },
            right: { kind: 'constant', value: 2 },
          },
        },
      ],
    };

    const result = solve(input);
    expect(result.ok).toBe(true);
    expect(geometry(result).points.get('d')?.[0]).toBeCloseTo(20, 5);
    expect(geometry(result).points.get('d')?.[1]).toBeCloseTo(5, 5);
  });

  it('solves signed horizontal and vertical point distances', () => {
    const result = solve({
      points: [
        { name: 'a', x: 0, y: 0, fixed: true },
        { name: 'b', x: -4, y: 8 },
      ],
      segments: [line('edge', 'a', 'b')],
      constraints: [
        {
          ...constraint('distance', 'b'),
          ref: 'a',
          axis: 'x',
          axisSign: -1,
          value: 12,
        },
        {
          ...constraint('distance', 'b'),
          ref: 'a',
          axis: 'y',
          axisSign: 1,
          value: 5,
        },
      ],
    });

    expect(result.ok).toBe(true);
    expect(geometry(result).points.get('b')?.[0]).toBeCloseTo(-12, 5);
    expect(geometry(result).points.get('b')?.[1]).toBeCloseTo(5, 5);
  });

  it('returns stable IDs for contradictory drivers', () => {
    const result = solve({
      points: [
        { name: 'a', x: 0, y: 0, fixed: true },
        { name: 'b', x: 12, y: 0 },
      ],
      segments: [line('edge', 'a', 'b')],
      constraints: [
        constraint('horizontal', 'edge'),
        { ...constraint('length', 'edge', 'first'), value: 10 },
        { ...constraint('length', 'edge', 'second'), value: 20 },
      ],
    });

    expect(result).toMatchObject({
      ok: false,
      kind: 'overconstrained',
      conflicting: expect.arrayContaining(['first', 'second']),
    });
  });

  it('uses the actual endpoint-radius arc center for tangency', () => {
    const result = solve({
      points: [
        { name: 'arc_start', x: 0, y: 0, fixed: true },
        { name: 'arc_end', x: 6, y: 0, fixed: true },
        { name: 'line_start', x: 0, y: 9, fixed: true },
        { name: 'line_end', x: 6, y: 9, fixed: true },
      ],
      segments: [
        {
          kind: 'arc',
          name: 'curve',
          from: { kind: 'point', name: 'arc_start' },
          to: { kind: 'point', name: 'arc_end' },
          radius: 5,
          clockwise: false,
        },
        line('edge', 'line_start', 'line_end'),
      ],
      constraints: [
        constraint('fixed', 'curve'),
        { ...constraint('tangent', 'edge'), ref: 'curve' },
      ],
    });

    expect(result.ok).toBe(true);
    expect(geometry(result).points.get('line_end')?.[1]).toBeCloseTo(9, 5);
  });
});

/**
 * Creates line geometry from the supplied endpoints.
 */
function line(name: string, from: string, to: string) {
  return {
    kind: 'line' as const,
    name,
    from: { kind: 'point' as const, name: from },
    to: { kind: 'point' as const, name: to },
  };
}

/**
 * Handles constraint in the core flow.
 */
function constraint(
  kind: SolveInput['constraints'][number]['kind'],
  target: string,
  id?: string,
): SolveInput['constraints'][number] {
  return { id, kind, target, spanLine: 1, spanCol: 1 };
}
