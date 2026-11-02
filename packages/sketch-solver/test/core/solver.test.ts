/**
 * @author Aidan Boissonneault
 * @file solver.test.ts
 * @purpose Tests solver behavior in the core in sketch solver package.
 * @last-edited October 6, 2026
 */

import { describe, it, expect } from 'vitest';
import { solve } from '../../src/core/solver.js';
import type { SolveInput, SolveResult } from '../../src/types/types.js';

const EPS = 1e-5;

/**
 * Handles approx in the core flow.
 */
function approx(a: number, b: number): boolean {
  return Math.abs(a - b) < EPS;
}

/**
 * Handles pt approx in the core flow.
 */
function ptApprox(pt: [number, number], x: number, y: number): boolean {
  return approx(pt[0], x) && approx(pt[1], y);
}

/**
 * Handles result points in the core flow.
 */
function resultPoints(result: SolveResult): Map<string, [number, number]> {
  if ('points' in result) return result.points;
  throw new Error(
    `Expected solver result to include points, got ${result.kind}`,
  );
}

// ── Test 1: No constraints, returns initial coords ───────────────────────────
describe('solve - no constraints', () => {
  it('returns initial coordinates unchanged', () => {
    const input: SolveInput = {
      points: [
        { name: 'a', x: 0, y: 0 },
        { name: 'b', x: 10, y: 0 },
      ],
      segments: [
        {
          kind: 'line',
          name: 'bottom',
          from: { kind: 'point', name: 'a' },
          to: { kind: 'point', name: 'b' },
        },
      ],
      constraints: [],
    };
    const result = solve(input);
    expect(
      result.ok === false && result.kind === 'underconstrained'
        ? true
        : result.ok,
    ).toBe(true);
    // Points unchanged
    const pts = resultPoints(result);
    expect(ptApprox(pts.get('a')!, 0, 0)).toBe(true);
    expect(ptApprox(pts.get('b')!, 10, 0)).toBe(true);
  });
});

// ── Test 2: Fixed point ──────────────────────────────────────────────────────
describe('solve - fixed point', () => {
  it('keeps fixed point at initial coords', () => {
    const input: SolveInput = {
      points: [
        { name: 'a', x: 5, y: 3 },
        { name: 'b', x: 15, y: 3 },
      ],
      segments: [
        {
          kind: 'line',
          name: 's',
          from: { kind: 'point', name: 'a' },
          to: { kind: 'point', name: 'b' },
        },
      ],
      constraints: [
        { kind: 'fixed', target: 'a', spanLine: 1, spanCol: 1 },
        { kind: 'horizontal', target: 's', spanLine: 2, spanCol: 1 },
        { kind: 'length', target: 's', value: 10, spanLine: 3, spanCol: 1 },
      ],
    };
    const result = solve(input);
    expect(result.ok).toBe(true);
    const pts = resultPoints(result);
    expect(ptApprox(pts.get('a')!, 5, 3)).toBe(true);
    expect(ptApprox(pts.get('b')!, 15, 3)).toBe(true);
  });
});

// ── Test 3: Horizontal + length → full rect ──────────────────────────────────
describe('solve - rectangular profile', () => {
  it('solves fully constrained rect with 4 points', () => {
    const input: SolveInput = {
      points: [
        { name: 'a', x: 0, y: 0 },
        { name: 'b', x: 60, y: 1 }, // slightly off
        { name: 'c', x: 61, y: 40 }, // slightly off
        { name: 'd', x: 0, y: 40 },
      ],
      segments: [
        {
          kind: 'line',
          name: 'bottom',
          from: { kind: 'point', name: 'a' },
          to: { kind: 'point', name: 'b' },
        },
        {
          kind: 'line',
          name: 'right',
          from: { kind: 'point', name: 'b' },
          to: { kind: 'point', name: 'c' },
        },
        {
          kind: 'line',
          name: 'top',
          from: { kind: 'point', name: 'c' },
          to: { kind: 'point', name: 'd' },
        },
        {
          kind: 'line',
          name: 'left',
          from: { kind: 'point', name: 'd' },
          to: { kind: 'point', name: 'a' },
        },
      ],
      constraints: [
        { kind: 'fixed', target: 'a', spanLine: 1, spanCol: 1 },
        { kind: 'horizontal', target: 'bottom', spanLine: 2, spanCol: 1 },
        { kind: 'vertical', target: 'right', spanLine: 3, spanCol: 1 },
        { kind: 'horizontal', target: 'top', spanLine: 4, spanCol: 1 },
        { kind: 'vertical', target: 'left', spanLine: 5, spanCol: 1 },
        {
          kind: 'length',
          target: 'bottom',
          value: 60,
          spanLine: 6,
          spanCol: 1,
        },
        { kind: 'length', target: 'right', value: 40, spanLine: 7, spanCol: 1 },
      ],
    };
    const result = solve(input);
    expect(result.ok).toBe(true);
    const pts = resultPoints(result);
    expect(ptApprox(pts.get('a')!, 0, 0)).toBe(true);
    expect(ptApprox(pts.get('b')!, 60, 0)).toBe(true);
    expect(ptApprox(pts.get('c')!, 60, 40)).toBe(true);
    expect(ptApprox(pts.get('d')!, 0, 40)).toBe(true);
  });
});

// ── Test 4: Perpendicular constraint ─────────────────────────────────────────
describe('solve - perpendicular', () => {
  it('makes segments perpendicular', () => {
    const input: SolveInput = {
      points: [
        { name: 'o', x: 0, y: 0 },
        { name: 'a', x: 30, y: 2 }, // slightly off horizontal
        { name: 'b', x: 31, y: 20 }, // slightly off vertical from a
      ],
      segments: [
        {
          kind: 'line',
          name: 'base',
          from: { kind: 'point', name: 'o' },
          to: { kind: 'point', name: 'a' },
        },
        {
          kind: 'line',
          name: 'side',
          from: { kind: 'point', name: 'a' },
          to: { kind: 'point', name: 'b' },
        },
      ],
      constraints: [
        { kind: 'fixed', target: 'o', spanLine: 1, spanCol: 1 },
        { kind: 'horizontal', target: 'base', spanLine: 2, spanCol: 1 },
        {
          kind: 'perpendicular',
          target: 'side',
          ref: 'base',
          spanLine: 3,
          spanCol: 1,
        },
        { kind: 'length', target: 'base', value: 30, spanLine: 4, spanCol: 1 },
        { kind: 'length', target: 'side', value: 20, spanLine: 5, spanCol: 1 },
      ],
    };
    const result = solve(input);
    expect(result.ok).toBe(true);
    const pts = resultPoints(result);
    const a = pts.get('a')!;
    const b = pts.get('b')!;
    // side should be vertical (x unchanged from a)
    expect(approx(a[0], b[0])).toBe(true);
    expect(approx(Math.abs(b[1] - a[1]), 20)).toBe(true);
  });
});

// ── Test 5: Parallel constraint ──────────────────────────────────────────────
describe('solve - parallel', () => {
  it('makes two segments parallel', () => {
    const input: SolveInput = {
      points: [
        { name: 'p0', x: 0, y: 0 },
        { name: 'p1', x: 40, y: 1 }, // slightly off
        { name: 'p2', x: 0, y: 20 },
        { name: 'p3', x: 40, y: 21 }, // slightly off
      ],
      segments: [
        {
          kind: 'line',
          name: 'bottom',
          from: { kind: 'point', name: 'p0' },
          to: { kind: 'point', name: 'p1' },
        },
        {
          kind: 'line',
          name: 'top',
          from: { kind: 'point', name: 'p2' },
          to: { kind: 'point', name: 'p3' },
        },
      ],
      constraints: [
        { kind: 'fixed', target: 'p0', spanLine: 1, spanCol: 1 },
        { kind: 'fixed', target: 'p2', spanLine: 2, spanCol: 1 },
        { kind: 'horizontal', target: 'bottom', spanLine: 3, spanCol: 1 },
        {
          kind: 'parallel',
          target: 'top',
          ref: 'bottom',
          spanLine: 4,
          spanCol: 1,
        },
        {
          kind: 'length',
          target: 'bottom',
          value: 40,
          spanLine: 5,
          spanCol: 1,
        },
        { kind: 'length', target: 'top', value: 40, spanLine: 6, spanCol: 1 },
      ],
    };
    const result = solve(input);
    expect(result.ok).toBe(true);
    const pts = resultPoints(result);
    const p0 = pts.get('p0')!;
    const p1 = pts.get('p1')!;
    const p2 = pts.get('p2')!;
    const p3 = pts.get('p3')!;
    // cross product of direction vectors = 0
    const cross =
      (p1[0] - p0[0]) * (p3[1] - p2[1]) - (p1[1] - p0[1]) * (p3[0] - p2[0]);
    expect(Math.abs(cross)).toBeLessThan(EPS * 1000);
  });
});

// ── Test 6: Underconstrained returns warning ──────────────────────────────────
describe('solve - underconstrained', () => {
  it('reports underconstrained when DOF > 0', () => {
    const input: SolveInput = {
      points: [
        { name: 'a', x: 0, y: 0 },
        { name: 'b', x: 10, y: 0 },
      ],
      segments: [
        {
          kind: 'line',
          name: 's',
          from: { kind: 'point', name: 'a' },
          to: { kind: 'point', name: 'b' },
        },
      ],
      constraints: [
        // Only one constraint for 4 DOF = 3 free DOF
        { kind: 'horizontal', target: 's', spanLine: 1, spanCol: 1 },
      ],
    };
    const result = solve(input);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.kind).toBe('underconstrained');
      if (result.kind === 'underconstrained') {
        expect(result.dof).toBeGreaterThan(0);
      }
    }
  });
});

// ── Test 7: Equal length constraint ──────────────────────────────────────────
describe('solve - equal length', () => {
  it('makes two segments equal length', () => {
    const input: SolveInput = {
      points: [
        { name: 'a', x: 0, y: 0 },
        { name: 'b', x: 30, y: 0 },
        { name: 'c', x: 30, y: 25 }, // slightly off from 30
        { name: 'd', x: 0, y: 30 },
      ],
      segments: [
        {
          kind: 'line',
          name: 's1',
          from: { kind: 'point', name: 'a' },
          to: { kind: 'point', name: 'b' },
        },
        {
          kind: 'line',
          name: 's2',
          from: { kind: 'point', name: 'c' },
          to: { kind: 'point', name: 'd' },
        },
      ],
      constraints: [
        { kind: 'fixed', target: 'a', spanLine: 1, spanCol: 1 },
        { kind: 'fixed', target: 'b', spanLine: 2, spanCol: 1 },
        { kind: 'fixed', target: 'd', spanLine: 3, spanCol: 1 },
        { kind: 'horizontal', target: 's1', spanLine: 4, spanCol: 1 },
        { kind: 'equal', target: 's2', ref: 's1', spanLine: 5, spanCol: 1 },
        { kind: 'vertical', target: 's2', spanLine: 6, spanCol: 1 },
      ],
    };
    const result = solve(input);
    expect(result.ok).toBe(true);
    const pts = resultPoints(result);
    const a = pts.get('a')!;
    const b = pts.get('b')!;
    const c = pts.get('c')!;
    const d = pts.get('d')!;
    const len1 = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const len2 = Math.hypot(d[0] - c[0], d[1] - c[1]);
    expect(approx(len1, len2)).toBe(true);
  });
});

// ── Test 8: Fixed points only (no free vars) ──────────────────────────────────
describe('solve - all points fixed', () => {
  it('returns ok immediately with no variables to solve', () => {
    const input: SolveInput = {
      points: [
        { name: 'a', x: 0, y: 0, fixed: true },
        { name: 'b', x: 10, y: 0, fixed: true },
      ],
      segments: [],
      constraints: [],
    };
    const result = solve(input);
    expect(result.ok).toBe(true);
  });
});
