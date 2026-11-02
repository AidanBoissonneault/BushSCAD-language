/**
 * @author Aidan Boissonneault
 * @file radial-curve.ts
 * @purpose Provides radial curve behavior for the operations in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

import type { IRRadialCurve } from '@bushscad/ir';

const NAMED_BEZIERS: Record<string, [number, number, number, number]> = {
  ease: [0.25, 0.1, 0.25, 1.0],
  'ease-in': [0.42, 0.0, 1.0, 1.0],
  'ease-out': [0.0, 0.0, 0.58, 1.0],
  'ease-in-out': [0.42, 0.0, 0.58, 1.0],
};

/**
 * Handles bezier at in the operations flow.
 */
function bezierAt(p1: number, p2: number, s: number): number {
  const c = 3 * p1;
  const b = 3 * (p2 - p1) - c;
  const a = 1 - c - b;
  return ((a * s + b) * s + c) * s;
}

/**
 * Handles bezier derivative at in the operations flow.
 */
function bezierDerivativeAt(p1: number, p2: number, s: number): number {
  const c = 3 * p1;
  const b = 3 * (p2 - p1) - c;
  const a = 1 - c - b;
  return (3 * a * s + 2 * b) * s + c;
}

/**
 * Handles solve bezier in the operations flow.
 */
function solveBezier(u: number, x1: number, x2: number): number {
  if (u <= 0) return 0;
  if (u >= 1) return 1;
  let s = u;
  for (let i = 0; i < 8; i++) {
    const x = bezierAt(x1, x2, s) - u;
    if (Math.abs(x) < 1e-7) return s;
    const dx = bezierDerivativeAt(x1, x2, s);
    if (Math.abs(dx) < 1e-9) break;
    s -= x / dx;
  }
  let lo = 0;
  let hi = 1;
  while (hi - lo > 1e-7) {
    const mid = (lo + hi) / 2;
    if (bezierAt(x1, x2, mid) < u) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** CSS-style remap of sweep parameter u∈[0,1] → t∈[0,1] per curve type. */
export function remapRadialCurve(u: number, curve: IRRadialCurve): number {
  switch (curve.kind) {
    case 'natural':
    case 'linear':
      return u;
    case 'step-start':
      return u > 0 ? 1 : 0;
    case 'step-end':
      return u >= 1 ? 1 : 0;
    case 'cubic-bezier': {
      const s = solveBezier(u, curve.x1, curve.x2);
      return bezierAt(curve.y1, curve.y2, s);
    }
    case 'ease':
    case 'ease-in':
    case 'ease-out':
    case 'ease-in-out': {
      const [x1, y1, x2, y2] = NAMED_BEZIERS[curve.kind];
      const s = solveBezier(u, x1, x2);
      return bezierAt(y1, y2, s);
    }
  }
}

/** Station count picked by curve type and sweep extent. Higher curvature → more stations. */
export function autoRadialStationCount(
  curve: IRRadialCurve,
  absAngleDeg: number,
): number {
  if (curve.kind === 'step-start' || curve.kind === 'step-end') {
    return Math.max(8, Math.ceil(absAngleDeg / 5));
  }
  if (curve.kind === 'natural' || curve.kind === 'linear') {
    // Ruled loft is faceted between stations, so use higher density here for
    // a visually smooth swept side surface.
    return Math.max(24, Math.ceil(absAngleDeg / 2));
  }
  if (curve.kind === 'cubic-bezier') {
    return Math.max(48, Math.ceil(absAngleDeg));
  }
  return Math.max(36, Math.ceil(absAngleDeg / 1.5));
}
