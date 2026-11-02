/**
 * @author Aidan Boissonneault
 * @file wrapLineSegments.ts
 * @purpose Provides wrap line segments behavior for the geometry in IR package.
 * @last-edited October 6, 2026
 */

import type { WrapMode } from '../ast/sketchPrimitives.js';
import type { IRProfileSegment } from '../sketch/sketchIr.js';
import type { WrapPoint } from './wrapTypes.js';
import { GEOM_EPS, pointDistance, samePoint, signedArea } from './wrapTypes.js';

const FLEX_RATIO = 0.12;
const FLEX_STEPS = 8;

/**
 * Selected members of WrapMode used for wrap line flex mode.
 */
type WrapLineFlexMode = Extract<WrapMode, 'convex' | 'concave'>;

/**
 * Context for wrap line flex, including probe mode and orientation.
 */
export type WrapLineFlexContext = {
  mode: WrapLineFlexMode;
  orientation: number;
};

/**
 * Creates the generated closed edge loop for wrap points.
 * Ordered, convex, concave, degenerate rounded, and rounded fallback paths all
 * need consistent generated segment names and closure behavior.
 */
export function closedWrapLineSegments(
  points: WrapPoint[],
  mode: WrapMode = 'ordered',
): IRProfileSegment[] {
  const flex = wrapLineFlexContext(points, mode);
  return points.flatMap((from, index) =>
    generatedWrapLineSegments(
      from,
      points[(index + 1) % points.length],
      flex ? `${mode}_edge_${index + 1}` : `edge_${index + 1}`,
      flex,
    ),
  );
}

/**
 * Resolves the flex behavior for generated wrap edges.
 * `concave` and `convex` modify only edges created by wrap lowering. Keeping
 * the context explicit prevents authored path/profile lines from participating.
 */
export function wrapLineFlexContext(
  points: WrapPoint[],
  mode: WrapMode,
): WrapLineFlexContext | null {
  if (mode !== 'concave' && mode !== 'convex') return null;
  if (points.length < 3) return null;
  return { mode, orientation: signedArea(points) >= 0 ? 1 : -1 };
}

/**
 * Builds one generated wrap edge, optionally bowed by the wrap mode.
 * This is the single gate where wrap-created straight spans become convex or
 * concave curves. Authored path lines never call this helper.
 */
export function generatedWrapLineSegments(
  from: WrapPoint,
  to: WrapPoint,
  name: string,
  flex: WrapLineFlexContext | null,
): IRProfileSegment[] {
  if (samePoint(from, to)) return [];
  if (!flex) return [{ kind: 'line', name, from, to }];

  const points = flexedLinePoints(from, to, flex);
  return points.slice(0, -1).map((point, index) => ({
    kind: 'line',
    name: `${name}_${index + 1}`,
    from: point,
    to: points[index + 1],
  }));
}

/**
 * Handles flexed line points in the geometry flow.
 */
function flexedLinePoints(
  from: WrapPoint,
  to: WrapPoint,
  flex: WrapLineFlexContext,
): WrapPoint[] {
  const length = pointDistance(from, to);
  if (length <= GEOM_EPS) return [from, to];

  const normal = flexNormal(from, to, flex, length);
  const midpoint: WrapPoint = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2];
  const control: WrapPoint = [
    midpoint[0] + normal[0] * length * FLEX_RATIO,
    midpoint[1] + normal[1] * length * FLEX_RATIO,
  ];

  const points: WrapPoint[] = [];
  for (let step = 0; step <= FLEX_STEPS; step++) {
    points.push(quadraticPoint(from, control, to, step / FLEX_STEPS));
  }
  return points;
}

/**
 * Handles flex normal in the geometry flow.
 */
function flexNormal(
  from: WrapPoint,
  to: WrapPoint,
  flex: WrapLineFlexContext,
  length: number,
): WrapPoint {
  const interiorSign =
    flex.mode === 'concave' ? flex.orientation : -flex.orientation;
  return [
    (-(to[1] - from[1]) / length) * interiorSign,
    ((to[0] - from[0]) / length) * interiorSign,
  ];
}

/**
 * Handles quadratic point in the geometry flow.
 */
function quadraticPoint(
  start: WrapPoint,
  control: WrapPoint,
  end: WrapPoint,
  t: number,
): WrapPoint {
  const inverse = 1 - t;
  return [
    inverse ** 2 * start[0] + 2 * inverse * t * control[0] + t ** 2 * end[0],
    inverse ** 2 * start[1] + 2 * inverse * t * control[1] + t ** 2 * end[1],
  ];
}
