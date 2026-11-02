/**
 * @author Aidan Boissonneault
 * @file arcSampling.ts
 * @purpose Samples points along 2D circular arcs for sketch and geometry previews.
 * @last-edited October 6, 2026
 */

/**
 * point2d represented by readonly [number, number].
 */

export type Point2d = readonly [number, number];

/**
 * Samples a circular arc around an already resolved center point.
 * Profile analysis and sketch-editor closed-body detection both need the same
 * angular stepping behavior, while each layer owns its own arc-center rules.
 */
export function sampleArcAroundCenter2d(
  center: Point2d,
  from: Point2d,
  to: Point2d,
  radius: number,
  clockwise: boolean,
  stepsPerTurn: number,
): [number, number][] {
  const start = Math.atan2(from[1] - center[1], from[0] - center[0]);
  let end = Math.atan2(to[1] - center[1], to[0] - center[0]);
  if (clockwise && end > start) end -= Math.PI * 2;
  if (!clockwise && end < start) end += Math.PI * 2;
  const steps = Math.max(
    4,
    Math.ceil((Math.abs(end - start) / (Math.PI * 2)) * stepsPerTurn),
  );
  const points: [number, number][] = [];
  for (let index = 0; index <= steps; index++) {
    const angle = start + ((end - start) * index) / steps;
    points.push([
      center[0] + Math.cos(angle) * radius,
      center[1] + Math.sin(angle) * radius,
    ]);
  }
  return points;
}
