/**
 * @author Aidan Boissonneault
 * @file sketch-overlay-geometry.ts
 * @purpose Provides sketch overlay geometry behavior for the sketch preview in three renderer package.
 * @last-edited October 6, 2026
 */

import type { IRPrimitive, IRProfileSegment } from '@bushscad/ir';
import {
  sketchArcPolyline,
  sketchEllipsePolyline,
  sketchSegmentsToLinePoints,
} from '@bushscad/ir';

/**
 * Three.js geometry used to draw profile outlines, construction geometry, and points in a sketch
 * preview.
 */
export type SketchOverlayGeometry = {
  readonly profiles: number[];
  readonly construction: number[];
  readonly points: number[];
};

/** Samples evaluated local sketch geometry for reusable 3D overlay buffers. */
export function sketchOverlayGeometry(
  primitive: IRPrimitive,
): SketchOverlayGeometry {
  const geometry: MutableSketchOverlayGeometry = {
    profiles: [],
    construction: [],
    points: [],
  };
  appendPrimitive(geometry, primitive, 0, 0);
  return geometry;
}

/**
 * Mutable sketch-preview geometry that lets the renderer update profile, construction, and point
 * buffers in place.
 */
type MutableSketchOverlayGeometry = {
  profiles: number[];
  construction: number[];
  points: number[];
};

/**
 * Appends primitive to the current output.
 */
function appendPrimitive(
  output: MutableSketchOverlayGeometry,
  primitive: IRPrimitive,
  offsetX: number,
  offsetY: number,
): void {
  if (primitive.kind === 'sketchAt') {
    appendPrimitive(
      output,
      primitive.primitive,
      offsetX + primitive.x,
      offsetY + primitive.y,
    );
    return;
  }
  if (primitive.kind === 'sketchAlias') {
    appendPrimitive(output, primitive.primitive, offsetX, offsetY);
    return;
  }
  if (primitive.kind === 'sketchBoolean') {
    appendPrimitive(output, primitive.left, offsetX, offsetY);
    appendPrimitive(output, primitive.right, offsetX, offsetY);
    return;
  }
  if (primitive.kind === 'sketchRef') return;
  if (primitive.kind === 'profile') {
    for (const segment of primitive.segments) {
      appendProfileSegment(output, segment, offsetX, offsetY);
    }
    return;
  }

  const loop = primitiveLoop(primitive).map(
    ([x, y]) => [x + offsetX, y + offsetY] as [number, number],
  );
  appendPolyline(output.profiles, loop, true);
  appendPoints(output.points, loop);
}

/**
 * Appends profile segment to the current output.
 */
function appendProfileSegment(
  output: MutableSketchOverlayGeometry,
  segment: IRProfileSegment,
  offsetX: number,
  offsetY: number,
): void {
  const points = segmentPolyline(segment).map(
    ([x, y]) => [x + offsetX, y + offsetY] as [number, number],
  );
  const target = segment.construction ? output.construction : output.profiles;
  target.push(...sketchSegmentsToLinePoints(points));
  appendPoints(output.points, [points[0], points.at(-1)!]);
}

/**
 * Creates a segment from its endpoint coordinates.
 */
function segmentPolyline(segment: IRProfileSegment): [number, number][] {
  if (segment.kind === 'arc') return sketchArcPolyline(segment);
  if (segment.kind === 'ellipse') return sketchEllipsePolyline(segment);
  return [segment.from, segment.to];
}

/**
 * Builds the primitive data required by the current operation.
 */
function primitiveLoop(
  primitive: Exclude<
    IRPrimitive,
    {
      kind:
        | 'profile'
        | 'sketchAt'
        | 'sketchAlias'
        | 'sketchBoolean'
        | 'sketchRef';
    }
  >,
): [number, number][] {
  switch (primitive.kind) {
    case 'rect':
      return rectangleLoop(primitive.width, primitive.height);
    case 'roundrect':
      return roundRectangleLoop(
        primitive.width,
        primitive.height,
        primitive.radius,
      );
    case 'circle':
      return ellipseLoop(primitive.diameter, primitive.diameter);
    case 'ellipse':
      return ellipseLoop(primitive.width, primitive.height);
    case 'triangle':
      return [
        [-primitive.base / 2, 0],
        [primitive.base / 2, 0],
        [0, primitive.height],
      ];
    case 'polygon':
      return primitive.points;
    case 'word': {
      const width = Math.max(
        primitive.size,
        primitive.text.length * primitive.size * 0.6,
      );
      return rectangleLoop(width, primitive.size);
    }
  }
}

/**
 * Creates rectangle geometry from the supplied dimensions.
 */
function rectangleLoop(width: number, height: number): [number, number][] {
  const x = width / 2;
  const y = height / 2;
  return [
    [-x, -y],
    [x, -y],
    [x, y],
    [-x, y],
  ];
}

/**
 * Handles round rectangle loop in the sketch preview flow.
 */
function roundRectangleLoop(
  width: number,
  height: number,
  requestedRadius: number,
): [number, number][] {
  const x = width / 2;
  const y = height / 2;
  const radius = Math.min(requestedRadius, x, y);
  const corners = [
    [x - radius, y - radius, 0],
    [-x + radius, y - radius, Math.PI / 2],
    [-x + radius, -y + radius, Math.PI],
    [x - radius, -y + radius, Math.PI * 1.5],
  ];
  return corners.flatMap(([cx, cy, start]) =>
    Array.from({ length: 9 }, (_, index) => {
      const angle = start + (index / 8) * (Math.PI / 2);
      return [cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius] as [
        number,
        number,
      ];
    }),
  );
}

/**
 * Creates ellipse geometry from its center and radii.
 */
function ellipseLoop(width: number, height: number): [number, number][] {
  return Array.from({ length: 64 }, (_, index) => {
    const angle = (index / 64) * Math.PI * 2;
    return [Math.cos(angle) * (width / 2), Math.sin(angle) * (height / 2)];
  });
}

/**
 * Appends polyline to the current output.
 */
function appendPolyline(
  target: number[],
  points: readonly [number, number][],
  closed: boolean,
): void {
  const limit = closed ? points.length : points.length - 1;
  for (let index = 0; index < limit; index++) {
    const from = points[index];
    const to = points[(index + 1) % points.length];
    target.push(from[0], from[1], 0, to[0], to[1], 0);
  }
}

/**
 * Appends points to the current output.
 */
function appendPoints(
  target: number[],
  points: readonly [number, number][],
): void {
  for (const [x, y] of points) target.push(x, y, 0);
}
