/**
 * @author Aidan Boissonneault
 * @file sketchPreviewGeometry.ts
 * @purpose Provides sketch preview geometry behavior for the sketch in IR package.
 * @last-edited October 6, 2026
 */

import type {
  IRArcSegment,
  IREllipseSegment,
  IRPrimitive,
} from '../shared/ir.js';
import type { SketchPreviewBounds } from './sketchPreview.js';
import { arcCenterCandidates } from '../geometry/geometry.js';
import { sampleEllipseSegment } from '../geometry/ellipseGeometry.js';

const ARC_SAMPLE_COUNT = 32;

/**
 * Compacts sketch number while preserving its values.
 */
export function compactSketchNumber(value: number): string {
  if (!Number.isFinite(value) || value === 0) return String(value);
  const rounded = Number(value.toFixed(3));
  if (rounded !== 0) return compactDecimal(rounded, 3);
  const leadingZeros = Math.max(
    0,
    -Math.floor(Math.log10(Math.abs(value))) - 1,
  );
  return compactDecimal(value, leadingZeros + 3);
}

/**
 * Compacts decimal while preserving its values.
 */
function compactDecimal(value: number, decimals: number): string {
  return value.toFixed(decimals).replace(/\.?0+$/, '');
}

/**
 * Handles sketch bounds from points in the sketch flow.
 */
export function sketchBoundsFromPoints(
  points: [number, number][],
): SketchPreviewBounds {
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const [x, y] of points) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }

  if (points.length === 0) {
    minX = 0;
    maxX = 0;
    minY = 0;
    maxY = 0;
  }

  return { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY };
}

/**
 * Handles signed sweep in the sketch flow.
 */
function signedSweep(
  center: [number, number],
  from: [number, number],
  to: [number, number],
  clockwise: boolean,
): number {
  const start = Math.atan2(from[1] - center[1], from[0] - center[0]);
  const end = Math.atan2(to[1] - center[1], to[0] - center[0]);
  let sweep = end - start;
  if (clockwise && sweep > 0) sweep -= Math.PI * 2;
  if (!clockwise && sweep < 0) sweep += Math.PI * 2;
  return sweep;
}

/**
 * Handles sketch arc center in the sketch flow.
 */
function sketchArcCenter(segment: IRArcSegment): [number, number] | null {
  const [x0, y0] = segment.from;
  const [x1, y1] = segment.to;
  const candidates = arcCenterCandidates([x0, y0], [x1, y1], segment.radius);
  if (!candidates) return null;

  return candidates.reduce((best, candidate) => {
    const bestSweep = Math.abs(
      signedSweep(best, segment.from, segment.to, segment.clockwise),
    );
    const candidateSweep = Math.abs(
      signedSweep(candidate, segment.from, segment.to, segment.clockwise),
    );
    return candidateSweep < bestSweep ? candidate : best;
  });
}

/**
 * Handles sketch arc polyline in the sketch flow.
 */
export function sketchArcPolyline(
  segment: IRArcSegment,
  steps = ARC_SAMPLE_COUNT,
): [number, number][] {
  const center = sketchArcCenter(segment);
  if (!center) return [segment.from, segment.to];

  const start = Math.atan2(
    segment.from[1] - center[1],
    segment.from[0] - center[0],
  );
  const sweep = signedSweep(
    center,
    segment.from,
    segment.to,
    segment.clockwise,
  );
  const points: [number, number][] = [];

  for (let i = 0; i <= steps; i++) {
    const angle = start + sweep * (i / steps);
    points.push([
      center[0] + Math.cos(angle) * segment.radius,
      center[1] + Math.sin(angle) * segment.radius,
    ]);
  }

  return points;
}

/** Samples an exact ellipse only for screen-space preview strokes. */
export function sketchEllipsePolyline(
  segment: IREllipseSegment,
  steps = 64,
): [number, number][] {
  return sampleEllipseSegment(segment, steps);
}

/**
 * Handles sketch segments to line points in the sketch flow.
 */
export function sketchSegmentsToLinePoints(
  points: [number, number][],
): number[] {
  const positions: number[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[i + 1];
    positions.push(x0, y0, 0, x1, y1, 0);
  }
  return positions;
}

/**
 * Handles sketch preview primitive bounds in the sketch flow.
 */
export function sketchPreviewPrimitiveBounds(
  primitive: IRPrimitive,
): SketchPreviewBounds {
  switch (primitive.kind) {
    case 'rect':
    case 'roundrect':
      return {
        minX: -primitive.width / 2,
        maxX: primitive.width / 2,
        minY: -primitive.height / 2,
        maxY: primitive.height / 2,
        width: primitive.width,
        height: primitive.height,
      };
    case 'circle':
      return {
        minX: -primitive.diameter / 2,
        maxX: primitive.diameter / 2,
        minY: -primitive.diameter / 2,
        maxY: primitive.diameter / 2,
        width: primitive.diameter,
        height: primitive.diameter,
      };
    case 'ellipse':
      return {
        minX: -primitive.width / 2,
        maxX: primitive.width / 2,
        minY: -primitive.height / 2,
        maxY: primitive.height / 2,
        width: primitive.width,
        height: primitive.height,
      };
    case 'triangle':
      return {
        minX: -primitive.base / 2,
        maxX: primitive.base / 2,
        minY: 0,
        maxY: primitive.height,
        width: primitive.base,
        height: primitive.height,
      };
    case 'polygon':
      return sketchBoundsFromPoints(primitive.points);
    case 'profile': {
      const points: [number, number][] = [];
      for (const segment of primitive.segments) {
        if (segment.kind === 'arc') points.push(...sketchArcPolyline(segment));
        else if (segment.kind === 'ellipse') {
          points.push(...sketchEllipsePolyline(segment));
        } else points.push(segment.from, segment.to);
      }
      return sketchBoundsFromPoints(points);
    }
    case 'word': {
      const width = Math.max(
        primitive.size,
        primitive.text.length * primitive.size * 0.6,
      );
      return {
        minX: -width / 2,
        maxX: width / 2,
        minY: -primitive.size / 2,
        maxY: primitive.size / 2,
        width,
        height: primitive.size,
      };
    }
    case 'sketchAt': {
      const b = sketchPreviewPrimitiveBounds(primitive.primitive);
      return {
        minX: b.minX + primitive.x,
        maxX: b.maxX + primitive.x,
        minY: b.minY + primitive.y,
        maxY: b.maxY + primitive.y,
        width: b.width,
        height: b.height,
      };
    }
    case 'sketchAlias':
      return sketchPreviewPrimitiveBounds(primitive.primitive);
    case 'sketchBoolean': {
      const left = sketchPreviewPrimitiveBounds(primitive.left);
      const right = sketchPreviewPrimitiveBounds(primitive.right);
      const minX = Math.min(left.minX, right.minX);
      const maxX = Math.max(left.maxX, right.maxX);
      const minY = Math.min(left.minY, right.minY);
      const maxY = Math.max(left.maxY, right.maxY);
      return {
        minX,
        maxX,
        minY,
        maxY,
        width: maxX - minX,
        height: maxY - minY,
      };
    }
    case 'sketchRef':
      return { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 0, height: 0 };
  }
}

/**
 * Handles sketch points equal in the sketch flow.
 */
export function sketchPointsEqual(
  a: [number, number],
  b: [number, number],
): boolean {
  return Math.abs(a[0] - b[0]) <= 1e-7 && Math.abs(a[1] - b[1]) <= 1e-7;
}
