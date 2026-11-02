/**
 * @author Aidan Boissonneault
 * @file conicIntersections.ts
 * @purpose Provides conic intersections behavior for the geometry in IR package.
 * @last-edited October 6, 2026
 */

import type {
  IRArcSegment,
  IREllipseSegment,
  IRLineSegment,
  IRProfileSegment,
} from '../sketch/sketchIr.js';
import { profileArcCenter } from './profileContainment.js';
import {
  ELLIPSE_TOLERANCE,
  ellipsePoint,
  ellipseSegmentParameter,
} from './ellipseGeometry.js';
import { realPolynomialRoots } from './polynomialRealRoots.js';

/**
 * Conic intersection, including point, first parameter, second parameter, and tangent.
 */
export type ConicIntersection = {
  point: [number, number];
  firstParameter: number;
  secondParameter: number;
  tangent: boolean;
};

/**
 * Result of conic intersection accepts { relation: 'discrete'; intersections: ConicInters and {
 * relation: 'coincident'; intersections: [] }.
 */
export type ConicIntersectionResult =
  | { relation: 'discrete'; intersections: ConicIntersection[] }
  | { relation: 'coincident'; intersections: [] };

/** Intersects an exact ellipse interval with a line, circle arc, or ellipse. */
export function intersectEllipseSegment(
  ellipse: IREllipseSegment,
  other: IRProfileSegment,
): ConicIntersectionResult {
  if (other.kind === 'line') return intersectLineEllipse(other, ellipse, true);
  const otherEllipse = other.kind === 'ellipse' ? other : ellipseFromArc(other);
  const result = intersectEllipses(ellipse, otherEllipse);
  if (result.relation === 'coincident') return result;
  return {
    relation: 'discrete',
    intersections: result.intersections
      .filter(
        (hit) =>
          other.kind !== 'arc' || arcParameter(other, hit.point) !== null,
      )
      .map((hit) =>
        other.kind !== 'arc'
          ? hit
          : { ...hit, secondParameter: arcParameter(other, hit.point)! },
      ),
  };
}

/**
 * Handles intersect line ellipse in the geometry flow.
 */
function intersectLineEllipse(
  line: IRLineSegment,
  ellipse: IREllipseSegment,
  ellipseFirst: boolean,
): ConicIntersectionResult {
  const dx = line.to[0] - line.from[0];
  const dy = line.to[1] - line.from[1];
  const ox = line.from[0] - ellipse.center[0];
  const oy = line.from[1] - ellipse.center[1];
  const a = (dx / ellipse.radiusX) ** 2 + (dy / ellipse.radiusY) ** 2;
  const b =
    2 * ((ox * dx) / ellipse.radiusX ** 2 + (oy * dy) / ellipse.radiusY ** 2);
  const c = (ox / ellipse.radiusX) ** 2 + (oy / ellipse.radiusY) ** 2 - 1;
  const roots = quadraticRoots(a, b, c);
  const intersections = roots.flatMap((lineParameter) => {
    if (
      lineParameter < -ELLIPSE_TOLERANCE ||
      lineParameter > 1 + ELLIPSE_TOLERANCE
    )
      return [];
    const point: [number, number] = [
      line.from[0] + dx * lineParameter,
      line.from[1] + dy * lineParameter,
    ];
    const angle = ellipseAngle(ellipse, point);
    const ellipseParameter = ellipseSegmentParameter(ellipse, angle);
    if (ellipseParameter === null) return [];
    const hit = {
      point,
      firstParameter: ellipseFirst ? ellipseParameter : lineParameter,
      secondParameter: ellipseFirst ? lineParameter : ellipseParameter,
      tangent: roots.length === 1,
    };
    return [hit];
  });
  return { relation: 'discrete', intersections: deduplicate(intersections) };
}

/**
 * Handles intersect ellipses in the geometry flow.
 */
function intersectEllipses(
  first: IREllipseSegment,
  second: IREllipseSegment,
): ConicIntersectionResult {
  const dx = first.center[0] - second.center[0];
  const dy = first.center[1] - second.center[1];
  const a = first.radiusX ** 2 / second.radiusX ** 2;
  const b = first.radiusY ** 2 / second.radiusY ** 2;
  const c = (2 * dx * first.radiusX) / second.radiusX ** 2;
  const d = (2 * dy * first.radiusY) / second.radiusY ** 2;
  const e = dx ** 2 / second.radiusX ** 2 + dy ** 2 / second.radiusY ** 2 - 1;
  const equation = [a + c + e, 2 * d, -2 * a + 4 * b + 2 * e, 2 * d, a - c + e];
  if (
    equation.every((coefficient) => Math.abs(coefficient) <= ELLIPSE_TOLERANCE)
  ) {
    return { relation: 'coincident', intersections: [] };
  }
  const angles = realPolynomialRoots(equation, ELLIPSE_TOLERANCE).map(
    (root) => 2 * Math.atan(root),
  );
  if (
    Math.abs(
      conicValue(
        second,
        ellipsePoint(first.center, first.radiusX, first.radiusY, Math.PI),
      ),
    ) <=
    ELLIPSE_TOLERANCE * 8
  ) {
    angles.push(Math.PI);
  }
  const intersections = angles.flatMap((angle) => {
    const point = ellipsePoint(
      first.center,
      first.radiusX,
      first.radiusY,
      angle,
    );
    const firstParameter = ellipseSegmentParameter(first, angle);
    const secondParameter = ellipseSegmentParameter(
      second,
      ellipseAngle(second, point),
    );
    if (firstParameter === null || secondParameter === null) return [];
    return [
      {
        point,
        firstParameter,
        secondParameter,
        tangent: gradientsParallel(first, second, point),
      },
    ];
  });
  return { relation: 'discrete', intersections: deduplicate(intersections) };
}

/**
 * Creates ellipse geometry from its center and radii.
 */
function ellipseFromArc(arc: IRArcSegment): IREllipseSegment {
  const center = profileArcCenter(arc);
  return {
    kind: 'ellipse',
    name: arc.name,
    center,
    radiusX: arc.radius,
    radiusY: arc.radius,
    from: [center[0] + arc.radius, center[1]],
    to: [center[0] + arc.radius, center[1]],
    startAngle: 0,
    endAngle: Math.PI * 2,
    clockwise: false,
    full: true,
  };
}

/**
 * Creates an arc from its center, radius, and angular limits.
 */
function arcParameter(
  arc: IRArcSegment,
  point: [number, number],
): number | null {
  const center = profileArcCenter(arc);
  const circle = ellipseFromArc(arc);
  circle.startAngle = Math.atan2(
    arc.from[1] - center[1],
    arc.from[0] - center[0],
  );
  circle.endAngle = Math.atan2(arc.to[1] - center[1], arc.to[0] - center[0]);
  circle.clockwise = arc.clockwise;
  circle.full = false;
  return ellipseSegmentParameter(circle, ellipseAngle(circle, point));
}

/**
 * Creates ellipse geometry from its center and radii.
 */
function ellipseAngle(
  ellipse: IREllipseSegment,
  point: readonly [number, number],
): number {
  return Math.atan2(
    (point[1] - ellipse.center[1]) / ellipse.radiusY,
    (point[0] - ellipse.center[0]) / ellipse.radiusX,
  );
}

/**
 * Handles conic value in the geometry flow.
 */
function conicValue(
  ellipse: IREllipseSegment,
  point: [number, number],
): number {
  return (
    ((point[0] - ellipse.center[0]) / ellipse.radiusX) ** 2 +
    ((point[1] - ellipse.center[1]) / ellipse.radiusY) ** 2 -
    1
  );
}

/**
 * Handles gradients parallel in the geometry flow.
 */
function gradientsParallel(
  a: IREllipseSegment,
  b: IREllipseSegment,
  point: [number, number],
): boolean {
  const ax = (point[0] - a.center[0]) / a.radiusX ** 2;
  const ay = (point[1] - a.center[1]) / a.radiusY ** 2;
  const bx = (point[0] - b.center[0]) / b.radiusX ** 2;
  const by = (point[1] - b.center[1]) / b.radiusY ** 2;
  return (
    Math.abs(ax * by - ay * bx) <=
    ELLIPSE_TOLERANCE * Math.max(1, Math.hypot(ax, ay) * Math.hypot(bx, by))
  );
}

/**
 * Handles quadratic roots in the geometry flow.
 */
function quadraticRoots(a: number, b: number, c: number): number[] {
  if (Math.abs(a) <= ELLIPSE_TOLERANCE)
    return Math.abs(b) <= ELLIPSE_TOLERANCE ? [] : [-c / b];
  const discriminant = b * b - 4 * a * c;
  if (discriminant < -ELLIPSE_TOLERANCE) return [];
  if (Math.abs(discriminant) <= ELLIPSE_TOLERANCE) return [-b / (2 * a)];
  const root = Math.sqrt(discriminant);
  return [(-b - root) / (2 * a), (-b + root) / (2 * a)];
}

/**
 * Handles deduplicate in the geometry flow.
 */
function deduplicate(intersections: ConicIntersection[]): ConicIntersection[] {
  return intersections.filter(
    (hit, index) =>
      intersections.findIndex(
        (candidate) =>
          Math.hypot(
            candidate.point[0] - hit.point[0],
            candidate.point[1] - hit.point[1],
          ) <=
          ELLIPSE_TOLERANCE * 8,
      ) === index,
  );
}
