/**
 * @author Aidan Boissonneault
 * @file eval-sketch-reference-values.ts
 * @purpose Evaluates sketch reference values for the sketch in evaluator package.
 * @last-edited October 6, 2026
 */

import type { IRProfileSegment, SketchDimensionDecl } from '@bushscad/ir';

/**
 * Measures the displayed value for a reference sketch dimension.
 * Reference dimensions are annotations, not solver inputs, so their values are
 * derived from already-evaluated profile segments.
 */
export function measuredReferenceValue(
  dimension: SketchDimensionDecl,
  segments: IRProfileSegment[],
): number | undefined {
  return measureSketchDimension(
    dimension.dimension,
    dimension.target,
    dimension.ref,
    dimension.axis,
    segments,
  );
}

/** Measures a dimensional target from already-solved profile geometry. */
export function measureSketchDimension(
  dimension: SketchDimensionDecl['dimension'],
  target: string,
  ref: string | undefined,
  axis: SketchDimensionDecl['axis'],
  segments: IRProfileSegment[],
): number | undefined {
  if (dimension === 'length') return measuredLength(target, segments);
  if (dimension === 'distance' && ref)
    return measuredDistance(target, ref, axis, segments);
  if (dimension === 'angle')
    return measuredAngle(target, ref ?? null, segments);
  const segment = segmentByName(target, segments);
  if (segment?.kind !== 'arc') return undefined;
  return dimension === 'diameter' ? segment.radius * 2 : segment.radius;
}

/**
 * Handles measured length in the sketch flow.
 */
function measuredLength(
  target: string,
  segments: IRProfileSegment[],
): number | undefined {
  const segment = segmentByName(target, segments);
  return segment ? distance(segment.from, segment.to) : undefined;
}

/**
 * Handles measured distance in the sketch flow.
 */
function measuredDistance(
  target: string,
  ref: string,
  axis: SketchDimensionDecl['axis'],
  segments: IRProfileSegment[],
): number | undefined {
  const from = pointForRef(target, segments);
  if (!from) return undefined;
  const originDistance = measuredOriginReferenceDistance(from, ref);
  if (originDistance !== null) return originDistance;
  const to = pointForRef(ref, segments);
  if (!to) return undefined;
  return measuredPointPairDistance(from, to, axis);
}

/**
 * Handles measured origin reference distance in the sketch flow.
 */
function measuredOriginReferenceDistance(
  point: [number, number],
  ref: string,
): number | null {
  if (ref === 'origin') return distance(point, [0, 0]);
  if (ref === 'origin.x_axis') return Math.abs(point[1]);
  if (ref === 'origin.y_axis') return Math.abs(point[0]);
  return null;
}

/**
 * Handles measured point pair distance in the sketch flow.
 */
function measuredPointPairDistance(
  from: [number, number],
  to: [number, number],
  axis: SketchDimensionDecl['axis'],
): number {
  if (axis === 'x') return Math.abs(from[0] - to[0]);
  if (axis === 'y') return Math.abs(from[1] - to[1]);
  return distance(from, to);
}

/**
 * Handles measured angle in the sketch flow.
 */
function measuredAngle(
  targetName: string,
  referenceName: string | null,
  segments: IRProfileSegment[],
): number | undefined {
  const target = segmentByName(targetName, segments);
  if (!target) return undefined;

  const targetAngle = segmentAngle(target);
  if (!referenceName) return cleanAngle(normalizedDegrees(targetAngle));

  const axis = axisAngle(referenceName);
  const reference = segmentByName(referenceName, segments);
  const referenceAngle = axis ?? (reference ? segmentAngle(reference) : null);
  const measured =
    referenceAngle === null
      ? undefined
      : Math.abs(normalizedDegrees(targetAngle - referenceAngle));
  return measured === undefined ? undefined : cleanAngle(measured);
}

/**
 * Handles clean angle in the sketch flow.
 */
function cleanAngle(value: number): number {
  const absolute = Math.abs(value);
  return absolute < 1e-9 ? 0 : absolute;
}

/**
 * Builds the axis data required by the current operation.
 */
function axisAngle(referenceName: string): number | null {
  if (referenceName === 'origin.x_axis') return 0;
  if (referenceName === 'origin.y_axis') return Math.PI / 2;
  return null;
}

/**
 * Creates a segment from its endpoint coordinates.
 */
function segmentByName(
  name: string,
  segments: IRProfileSegment[],
): IRProfileSegment | undefined {
  return segments.find((item) => item.name === name);
}

/**
 * Creates a segment from its endpoint coordinates.
 */
function segmentAngle(segment: IRProfileSegment): number {
  return Math.atan2(
    segment.to[1] - segment.from[1],
    segment.to[0] - segment.from[0],
  );
}

/**
 * Handles normalized degrees in the sketch flow.
 */
function normalizedDegrees(radians: number): number {
  let degrees = (radians * 180) / Math.PI;
  while (degrees > 180) degrees -= 360;
  while (degrees < -180) degrees += 360;
  return degrees;
}

/**
 * Creates point geometry from the supplied coordinates.
 */
function pointForRef(
  ref: string,
  segments: IRProfileSegment[],
): [number, number] | null {
  const [segmentName, endpoint] = ref.split('.');
  const segment = segmentByName(segmentName, segments);
  if (!segment) return null;
  if (endpoint === 'start') return segment.from;
  if (endpoint === 'end') return segment.to;
  return null;
}

/**
 * Calculates the distance between the supplied points.
 */
function distance(a: [number, number], b: [number, number]): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}
