/**
 * @author Aidan Boissonneault
 * @file geometry.ts
 * @purpose Defines common 2D and 3D points and bounds and provides bounds calculations.
 * @last-edited October 6, 2026
 */

/**
 * point2 represented by readonly [number, number].
 */

export type Point2 = readonly [number, number];
/**
 * point3 represented by readonly [number, number, number].
 */
export type Point3 = readonly [number, number, number];

/**
 * Bounds2, including x min, x max, y min, and y max.
 */
export interface Bounds2 {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

/**
 * Bounds3, including z min and z max.
 */
export interface Bounds3 extends Bounds2 {
  zMin: number;
  zMax: number;
}

/**
 * Computes finite 2D bounds from a point iterable.
 * Sketch metrics and preview rendering need identical min/max behavior while
 * adapting the result shape for their own callers.
 */
export function bounds2FromPoints(
  points: Iterable<readonly [number, number, ...number[]]>,
): Bounds2 | null {
  let xMin = Infinity;
  let xMax = -Infinity;
  let yMin = Infinity;
  let yMax = -Infinity;
  for (const [x, y] of points) {
    xMin = Math.min(xMin, x);
    xMax = Math.max(xMax, x);
    yMin = Math.min(yMin, y);
    yMax = Math.max(yMax, y);
  }
  return Number.isFinite(xMin) ? { xMin, xMax, yMin, yMax } : null;
}

/**
 * Computes bounds from a non-empty 3D point list.
 */
export function bounds3FromPoints(points: Point3[]): Bounds3 | null {
  if (points.length === 0) return null;
  const xyBounds = bounds2FromPoints(points);
  if (!xyBounds) return null;
  let zMin = points[0][2];
  let zMax = points[0][2];
  for (const [, , z] of points.slice(1)) {
    zMin = Math.min(zMin, z);
    zMax = Math.max(zMax, z);
  }
  return { ...xyBounds, zMin, zMax };
}

/**
 * Handles normalize2 in the geometry flow.
 */
export function normalize2(x: number, y: number): [number, number] {
  const len = Math.hypot(x, y);
  if (!Number.isFinite(len) || len <= 1e-9) return [0, -1];
  return [x / len, y / len];
}

/**
 * Builds the profile data required by the current operation.
 */
export function profilePointToRevolveLocal(
  axis: 'x' | 'y' | 'z',
  radius: number,
  height: number,
): [number, number, number] {
  switch (axis) {
    case 'x':
      return [height, radius, 0];
    case 'y':
      return [radius, height, 0];
    case 'z':
      return [radius, 0, height];
  }
}

/**
 * Builds the profile data required by the current operation.
 */
export function profileVectorToRevolveLocal(
  axis: 'x' | 'y' | 'z',
  radial: number,
  axial: number,
): [number, number, number] {
  switch (axis) {
    case 'x':
      return [axial, radial, 0];
    case 'y':
      return [radial, axial, 0];
    case 'z':
      return [radial, 0, axial];
  }
}

/**
 * Resolves the outward local normal for a plant line in a revolve profile.
 */
export function revolvePlantLineLocalNormal(
  from: Point2,
  to: Point2,
  axis: 'x' | 'y' | 'z',
): [number, number, number] {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const [radial, axial] = normalize2(dy, -dx);
  return profileVectorToRevolveLocal(axis, radial, axial);
}

/**
 * Returns the two possible centers for an arc defined by endpoints and radius.
 */
export function arcCenterCandidates(
  from: Point2,
  to: Point2,
  radius: number,
): [number, number][] | null {
  const [x0, y0] = from;
  const [x1, y1] = to;
  const dx = x1 - x0;
  const dy = y1 - y0;
  const chord = Math.hypot(dx, dy);
  if (chord === 0 || radius <= 0) return null;
  const halfChord = chord / 2;
  const hSq = radius * radius - halfChord * halfChord;
  if (hSq < 0) return null;
  const mx = (x0 + x1) / 2;
  const my = (y0 + y1) / 2;
  const h = Math.sqrt(Math.max(0, hSq));
  const px = -dy / chord;
  const py = dx / chord;
  return [
    [mx + px * h, my + py * h],
    [mx - px * h, my - py * h],
  ];
}
