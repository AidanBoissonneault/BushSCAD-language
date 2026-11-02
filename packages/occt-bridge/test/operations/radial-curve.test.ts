/**
 * @author Aidan Boissonneault
 * @file radial-curve.test.ts
 * @purpose Tests radial curve behavior in the operations in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

import { describe, it, expect } from 'vitest';
import {
  remapRadialCurve,
  autoRadialStationCount,
} from '../../src/operations/radial-curve.js';

describe('remapRadialCurve', () => {
  it('natural and linear pass u through unchanged', () => {
    expect(remapRadialCurve(0, { kind: 'natural' })).toBe(0);
    expect(remapRadialCurve(0.5, { kind: 'natural' })).toBe(0.5);
    expect(remapRadialCurve(1, { kind: 'linear' })).toBe(1);
  });

  it('step-start jumps to 1 immediately', () => {
    expect(remapRadialCurve(0, { kind: 'step-start' })).toBe(0);
    expect(remapRadialCurve(0.0001, { kind: 'step-start' })).toBe(1);
    expect(remapRadialCurve(1, { kind: 'step-start' })).toBe(1);
  });

  it('step-end stays at 0 until u=1', () => {
    expect(remapRadialCurve(0, { kind: 'step-end' })).toBe(0);
    expect(remapRadialCurve(0.5, { kind: 'step-end' })).toBe(0);
    expect(remapRadialCurve(1, { kind: 'step-end' })).toBe(1);
  });

  it('endpoints are exact for named easings', () => {
    for (const kind of [
      'ease',
      'ease-in',
      'ease-out',
      'ease-in-out',
    ] as const) {
      expect(remapRadialCurve(0, { kind })).toBeCloseTo(0, 5);
      expect(remapRadialCurve(1, { kind })).toBeCloseTo(1, 5);
    }
  });

  it('ease-in lags below identity in the first half', () => {
    expect(remapRadialCurve(0.3, { kind: 'ease-in' })).toBeLessThan(0.3);
  });

  it('ease-out leads identity in the first half', () => {
    expect(remapRadialCurve(0.3, { kind: 'ease-out' })).toBeGreaterThan(0.3);
  });

  it('cubic-bezier matches CSS spec for identity curve', () => {
    const linearBezier = {
      kind: 'cubic-bezier',
      x1: 0,
      y1: 0,
      x2: 1,
      y2: 1,
    } as const;
    for (const u of [0, 0.25, 0.5, 0.75, 1]) {
      expect(remapRadialCurve(u, linearBezier)).toBeCloseTo(u, 4);
    }
  });

  it('cubic-bezier with skewed Y reproduces ease-out shape', () => {
    const earlyOut = {
      kind: 'cubic-bezier',
      x1: 0,
      y1: 0,
      x2: 0.58,
      y2: 1,
    } as const;
    expect(remapRadialCurve(0.5, earlyOut)).toBeGreaterThan(0.5);
    expect(remapRadialCurve(0, earlyOut)).toBeCloseTo(0, 5);
    expect(remapRadialCurve(1, earlyOut)).toBeCloseTo(1, 5);
  });
});

describe('autoRadialStationCount', () => {
  it('grows with sweep angle', () => {
    const small = autoRadialStationCount({ kind: 'linear' }, 30);
    const big = autoRadialStationCount({ kind: 'linear' }, 360);
    expect(big).toBeGreaterThan(small);
  });

  it('uses higher density for cubic-bezier than linear', () => {
    const lin = autoRadialStationCount({ kind: 'linear' }, 180);
    const bez = autoRadialStationCount(
      { kind: 'cubic-bezier', x1: 0.2, y1: 0.8, x2: 0.4, y2: 1.0 },
      180,
    );
    expect(bez).toBeGreaterThan(lin);
  });

  it('uses higher density for named easings than linear', () => {
    const lin = autoRadialStationCount({ kind: 'linear' }, 180);
    const eased = autoRadialStationCount({ kind: 'ease-in-out' }, 180);
    expect(eased).toBeGreaterThan(lin);
  });

  it('has a non-trivial floor for small angles', () => {
    expect(
      autoRadialStationCount({ kind: 'linear' }, 1),
    ).toBeGreaterThanOrEqual(8);
    expect(
      autoRadialStationCount(
        { kind: 'cubic-bezier', x1: 0, y1: 0, x2: 1, y2: 1 },
        1,
      ),
    ).toBeGreaterThanOrEqual(32);
  });
});
