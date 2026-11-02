/**
 * @author Aidan Boissonneault
 * @file wrapRoundedCorners.ts
 * @purpose Provides wrap rounded corners behavior for the geometry in IR package.
 * @last-edited October 6, 2026
 */

import { arcCenterCandidates } from './geometry.js';
import type { IRProfileSegment } from '../sketch/sketchIr.js';
import type { WrapMode } from '../ast/sketchPrimitives.js';
import {
  closedWrapLineSegments,
  generatedWrapLineSegments,
  wrapLineFlexContext,
} from './wrapLineSegments.js';
import type { WrapPoint } from './wrapTypes.js';
import {
  GEOM_EPS,
  clamp,
  pointDistance,
  samePoint,
  signedArea,
} from './wrapTypes.js';

const REFLEX_BLEND_STEPS = 8;

/**
 * Corner blend is tagged by kind: 'arc' carries radius, clockwise and 'sampled' carries point
 * geometry.
 */
type CornerBlend =
  | { kind: 'arc'; radius: number; clockwise: boolean }
  | { kind: 'sampled'; points: WrapPoint[] };

/**
 * Rounded corner, including before, after, and blend.
 */
type RoundedCorner = {
  before: WrapPoint;
  after: WrapPoint;
  blend: CornerBlend | null;
};

/**
 * Builds rounded profile segments around a closed wrap point loop.
 * Convex corners can stay as exact radius arcs, but acute reflex/open angles
 * need sampled tangent blends so the curve turns into the inward point instead
 * of being reinterpreted as a circular lobe by the radius-arc bridge path.
 */
export function roundedWrapSegments(
  points: WrapPoint[],
  radius: number,
  mode: WrapMode,
): IRProfileSegment[] {
  if (points.length < 3 || radius <= GEOM_EPS)
    return closedWrapLineSegments(points, mode);

  const flex = wrapLineFlexContext(points, mode);
  const corners = points.map((point, index) =>
    roundedCorner(points, point, index, radius),
  );
  const segments: IRProfileSegment[] = [];

  for (let index = 0; index < points.length; index++) {
    const previous = corners[(index - 1 + points.length) % points.length];
    const current = corners[index];
    if (!samePoint(previous.after, current.before)) {
      segments.push(
        ...generatedWrapLineSegments(
          previous.after,
          current.before,
          `${mode}_edge_${index + 1}`,
          flex,
        ),
      );
    }
    segments.push(
      ...cornerBlendSegments(current, `${mode}_round_${index + 1}`),
    );
  }

  return segments.length > 0 ? segments : closedWrapLineSegments(points, mode);
}

/**
 * Handles rounded corner in the geometry flow.
 */
function roundedCorner(
  points: WrapPoint[],
  point: WrapPoint,
  index: number,
  radius: number,
): RoundedCorner {
  const previous = points[(index - 1 + points.length) % points.length];
  const next = points[(index + 1) % points.length];
  const into = unit([previous[0] - point[0], previous[1] - point[1]]);
  const out = unit([next[0] - point[0], next[1] - point[1]]);
  if (!into || !out) return plainCorner(point);

  const openAngle = Math.acos(clamp(dot(into, out), -1, 1));
  if (openAngle <= GEOM_EPS || Math.PI - openAngle <= GEOM_EPS)
    return plainCorner(point);

  const tangent = Math.tan(openAngle / 2);
  const trim = Math.min(
    radius / tangent,
    pointDistance(point, previous) * 0.45,
    pointDistance(point, next) * 0.45,
  );
  if (trim <= GEOM_EPS) return plainCorner(point);

  const actualRadius = trim * tangent;
  const before: WrapPoint = [
    point[0] + into[0] * trim,
    point[1] + into[1] * trim,
  ];
  const after: WrapPoint = [point[0] + out[0] * trim, point[1] + out[1] * trim];

  if (isAcuteReflexVertex(points, index, openAngle)) {
    return {
      before,
      after,
      blend: {
        kind: 'sampled',
        points: reflexBlendPoints(before, point, after),
      },
    };
  }

  return {
    before,
    after,
    blend: {
      kind: 'arc',
      radius: actualRadius,
      clockwise: cornerArcClockwise(
        before,
        after,
        actualRadius,
        roundedCenter(point, into, out, actualRadius, openAngle),
      ),
    },
  };
}

/**
 * Handles plain corner in the geometry flow.
 */
function plainCorner(point: WrapPoint): RoundedCorner {
  return { before: point, after: point, blend: null };
}

/**
 * Handles corner blend segments in the geometry flow.
 */
function cornerBlendSegments(
  corner: RoundedCorner,
  name: string,
): IRProfileSegment[] {
  if (!corner.blend || samePoint(corner.before, corner.after)) return [];
  if (corner.blend.kind === 'arc') {
    return [
      {
        kind: 'arc',
        name,
        from: corner.before,
        to: corner.after,
        radius: corner.blend.radius,
        clockwise: corner.blend.clockwise,
      },
    ];
  }
  return sampledBlendSegments(corner.blend.points, name);
}

/**
 * Samples a cubic corner blend that is tangent to both incoming edges.
 * The original vertex acts as both cubic handles. That pulls the curve toward
 * the inward point while avoiding a cusp, which is the behavior users expect
 * when smoothing an acute open angle in a concave wrap profile.
 */
function reflexBlendPoints(
  before: WrapPoint,
  point: WrapPoint,
  after: WrapPoint,
): WrapPoint[] {
  const points: WrapPoint[] = [before];
  for (let step = 1; step < REFLEX_BLEND_STEPS; step++) {
    points.push(
      cubicPoint(before, point, point, after, step / REFLEX_BLEND_STEPS),
    );
  }
  points.push(after);
  return points;
}

/**
 * Handles sampled blend segments in the geometry flow.
 */
function sampledBlendSegments(
  points: WrapPoint[],
  name: string,
): IRProfileSegment[] {
  const segments: IRProfileSegment[] = [];
  for (let index = 0; index < points.length - 1; index++) {
    const from = points[index];
    const to = points[index + 1];
    if (samePoint(from, to)) continue;
    segments.push({
      kind: 'line',
      name: `${name}_${index + 1}`,
      from,
      to,
    });
  }
  return segments;
}

/**
 * Handles cubic point in the geometry flow.
 */
function cubicPoint(
  start: WrapPoint,
  handleA: WrapPoint,
  handleB: WrapPoint,
  end: WrapPoint,
  t: number,
): WrapPoint {
  const inverse = 1 - t;
  const a = inverse ** 3;
  const b = 3 * inverse ** 2 * t;
  const c = 3 * inverse * t ** 2;
  const d = t ** 3;
  return [
    a * start[0] + b * handleA[0] + c * handleB[0] + d * end[0],
    a * start[1] + b * handleA[1] + c * handleB[1] + d * end[1],
  ];
}

/**
 * Handles unit in the geometry flow.
 */
function unit(vector: WrapPoint): WrapPoint | null {
  const length = Math.hypot(vector[0], vector[1]);
  return length <= GEOM_EPS ? null : [vector[0] / length, vector[1] / length];
}

/**
 * Returns the dot product of the supplied vectors.
 */
function dot(a: WrapPoint, b: WrapPoint): number {
  return a[0] * b[0] + a[1] * b[1];
}

/**
 * Handles rounded center in the geometry flow.
 */
function roundedCenter(
  point: WrapPoint,
  into: WrapPoint,
  out: WrapPoint,
  radius: number,
  angle: number,
): WrapPoint {
  const bisector = unit([into[0] + out[0], into[1] + out[1]]);
  if (!bisector) return point;
  const distance = radius / Math.sin(angle / 2);
  return [point[0] + bisector[0] * distance, point[1] + bisector[1] * distance];
}

/**
 * Handles corner arc clockwise in the geometry flow.
 */
function cornerArcClockwise(
  from: WrapPoint,
  to: WrapPoint,
  radius: number,
  intendedCenter: WrapPoint,
): boolean {
  const candidates = arcCenterCandidates(from, to, radius) as
    | WrapPoint[]
    | null;
  if (!candidates) return false;
  const clockwiseCenter = selectedArcCenter(candidates, from, to, true);
  const ccwCenter = selectedArcCenter(candidates, from, to, false);
  const clockwiseDistance = pointDistance(clockwiseCenter, intendedCenter);
  const ccwDistance = pointDistance(ccwCenter, intendedCenter);
  return clockwiseDistance < ccwDistance;
}

/**
 * Returns the selected arc center from the current operation.
 */
function selectedArcCenter(
  candidates: WrapPoint[],
  from: WrapPoint,
  to: WrapPoint,
  clockwise: boolean,
): WrapPoint {
  return (
    candidates.find((center) =>
      centerMatchesSweep(center, from, to, clockwise),
    ) ?? candidates[0]
  );
}

/**
 * Handles center matches sweep in the geometry flow.
 */
function centerMatchesSweep(
  center: WrapPoint,
  from: WrapPoint,
  to: WrapPoint,
  clockwise: boolean,
): boolean {
  const start = Math.atan2(from[1] - center[1], from[0] - center[0]);
  const end = Math.atan2(to[1] - center[1], to[0] - center[0]);
  const ccwSweep = (end - start + Math.PI * 2) % (Math.PI * 2);
  const cwSweep = (start - end + Math.PI * 2) % (Math.PI * 2);
  return clockwise ? cwSweep <= Math.PI : ccwSweep <= Math.PI;
}

/**
 * Returns whether the input meets the `acute reflex vertex` condition.
 */
function isAcuteReflexVertex(
  points: WrapPoint[],
  index: number,
  openAngle: number,
): boolean {
  return openAngle < Math.PI - GEOM_EPS && reflexVertex(points, index);
}

/**
 * Handles reflex vertex in the geometry flow.
 */
function reflexVertex(points: WrapPoint[], index: number): boolean {
  const previous = points[(index - 1 + points.length) % points.length];
  const point = points[index];
  const next = points[(index + 1) % points.length];
  const turn =
    (point[0] - previous[0]) * (next[1] - point[1]) -
    (point[1] - previous[1]) * (next[0] - point[0]);
  const orientation = signedArea(points);
  return orientation >= 0 ? turn < -GEOM_EPS : turn > GEOM_EPS;
}
