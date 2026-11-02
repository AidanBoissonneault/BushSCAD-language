/**
 * @author Aidan Boissonneault
 * @file sketch-abilities.test.ts
 * @purpose Tests sketch abilities behavior in the sketch in evaluator package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import { parse } from '@bushscad/parser';
import { resolve } from '@bushscad/resolver';
import type { IRProfileSegment, IRSketch } from '@bushscad/ir';
import { sketchArcPolyline } from '@bushscad/ir';
import { evaluate } from '../../src/index.js';

/**
 * Handles no files in the sketch flow.
 */
const noFiles = () => null;

/**
 * Parses, resolves, and evaluates source text for sketch feature tests.
 *
 * Why:
 * New sketch syntax spans parser, resolver, and evaluator behavior, so these
 * tests need to assert the final IR rather than isolated AST shapes.
 */
function evalSketches(source: string): IRSketch[] {
  const parsed = parse(source, 'sketch-abilities.bscd');
  expect(parsed.errors.map((error) => error.message)).toEqual([]);
  const resolved = resolve(parsed.ast, 'sketch-abilities.bscd', noFiles);
  expect(resolved.errors.map((error) => error.message)).toEqual([]);
  const evaluated = evaluate(resolved.ast);
  expect(evaluated.errors.map((error) => error.message)).toEqual([]);
  return evaluated.program.ops.filter(
    (op): op is IRSketch => op.kind === 'sketch',
  );
}

/**
 * Builds the profile data required by the current operation.
 */
function profileSegments(sketch: IRSketch | undefined): IRProfileSegment[] {
  expect(sketch?.primitive.kind).toBe('profile');
  return sketch?.primitive.kind === 'profile' ? sketch.primitive.segments : [];
}

/**
 * Handles segments with prefix in the sketch flow.
 */
function segmentsWithPrefix(
  segments: IRProfileSegment[],
  prefix: string,
): IRProfileSegment[] {
  return segments.filter((segment) => segment.name.startsWith(prefix));
}

/**
 * Creates a segment from its endpoint coordinates.
 */
function segmentPolyline(segments: IRProfileSegment[]): [number, number][] {
  if (segments.length === 0) return [];
  const points: [number, number][] = [segments[0].from];
  for (const segment of segments) {
    if (segment.kind === 'arc') {
      points.push(...sketchArcPolyline(segment).slice(1));
    } else {
      points.push(segment.to);
    }
  }
  return points;
}

/**
 * Handles min distance to point in the sketch flow.
 */
function minDistanceToPoint(
  points: [number, number][],
  target: [number, number],
): number {
  return points.reduce(
    (min, point) =>
      Math.min(min, Math.hypot(point[0] - target[0], point[1] - target[1])),
    Number.POSITIVE_INFINITY,
  );
}

/**
 * Handles signed distance from line in the sketch flow.
 */
function signedDistanceFromLine(
  point: [number, number],
  from: [number, number],
  to: [number, number],
): number {
  const delta: [number, number] = [to[0] - from[0], to[1] - from[1]];
  return (
    (delta[0] * (point[1] - from[1]) - delta[1] * (point[0] - from[0])) /
    Math.hypot(delta[0], delta[1])
  );
}

/**
 * Asserts the expected reflex blend turns into point behavior in this test.
 */
function expectReflexBlendTurnsIntoPoint(
  segments: IRProfileSegment[],
  point: [number, number],
): void {
  expect(segments.length).toBeGreaterThan(2);
  expect(segments.every((segment) => segment.kind === 'line')).toBe(true);
  const endpoints = [segments[0].from, segments.at(-1)?.to ?? segments[0].to];
  const endpointDistance = Math.min(
    ...endpoints.map((endpoint) =>
      Math.hypot(endpoint[0] - point[0], endpoint[1] - point[1]),
    ),
  );
  const nearestBlendDistance = minDistanceToPoint(
    segmentPolyline(segments),
    point,
  );
  expect(nearestBlendDistance).toBeLessThan(endpointDistance * 0.35);
}

describe('new sketch abilities', () => {
  it('lowers path sketches with planted, named, inferred, arc, and close segments', () => {
    const sketches = evalSketches(`
sketch profile = path(
  plant bottom = line((0, 0), (20, 0)),
  right = line((20, 10)),
  crown = arc((10, 18), radius: 12, ccw),
  left = line(0, 10),
  return_edge = close()
);
`);

    const segments = profileSegments(
      sketches.find((sketch) => sketch.name === 'profile'),
    );

    expect(segments.map((segment) => segment.name)).toEqual([
      'bottom',
      'right',
      'crown',
      'left',
      'return_edge',
    ]);
    expect(segments[0]).toMatchObject({
      kind: 'line',
      from: [0, 0],
      to: [20, 0],
      plant: true,
    });
    expect(segments[1]).toMatchObject({ from: [20, 0], to: [20, 10] });
    expect(segments[2]).toMatchObject({
      kind: 'arc',
      from: [20, 10],
      to: [10, 18],
      radius: 12,
      clockwise: false,
    });
    expect(segments.at(-1)).toMatchObject({ from: [0, 10], to: [0, 0] });
  });

  it('supports anonymous path segments and explicit arc endpoints', () => {
    const sketches = evalSketches(`
sketch open_path = path(
  line((0, 0), (8, 0)),
  arc((8, 0), (12, 4), 6, cw),
  line(16, 4)
);
`);

    const segments = profileSegments(
      sketches.find((sketch) => sketch.name === 'open_path'),
    );

    expect(segments.map((segment) => segment.name)).toEqual([
      'segment_1',
      'segment_2',
      'segment_3',
    ]);
    expect(segments[1]).toMatchObject({
      kind: 'arc',
      from: [8, 0],
      to: [12, 4],
      radius: 6,
      clockwise: true,
    });
    expect(segments[2]).toMatchObject({
      kind: 'line',
      from: [12, 4],
      to: [16, 4],
    });
  });

  it('lowers wrap modes and keyword options to closed profiles', () => {
    const sketches = evalSketches(`
var points = [(-20, -10), (20, -10), (0, 0), (20, 10), (-20, 10)];
sketch ordered_shape = wrap(points, ordered, rounded: 2);
sketch convex_shape = wrap(points, convex, tolerance: 0.2);
sketch concave_shape = wrap(points, concave);
sketch smooth_shape = wrap(points, smooth, tension: 0.4);
`);

    const ordered = profileSegments(
      sketches.find((sketch) => sketch.name === 'ordered_shape'),
    );
    const convex = profileSegments(
      sketches.find((sketch) => sketch.name === 'convex_shape'),
    );
    const concave = profileSegments(
      sketches.find((sketch) => sketch.name === 'concave_shape'),
    );
    const smooth = profileSegments(
      sketches.find((sketch) => sketch.name === 'smooth_shape'),
    );

    expect(ordered).toHaveLength(17);
    expect(ordered.filter((segment) => segment.kind === 'arc')).toHaveLength(4);
    expect(ordered.find((segment) => segment.kind === 'arc')).toMatchObject({
      radius: 2,
    });
    expectReflexBlendTurnsIntoPoint(
      segmentsWithPrefix(ordered, 'ordered_round_3_'),
      [0, 0],
    );
    expect(convex).toHaveLength(32);
    expect(
      convex.some((segment) =>
        [segment.from, segment.to].some(([x, y]) => x === 0 && y === 0),
      ),
    ).toBe(false);
    const convexRight = segmentsWithPrefix(convex, 'convex_edge_2_');
    expect(convexRight).toHaveLength(8);
    expect(segmentPolyline(convexRight).some(([x]) => x > 20.5)).toBe(true);
    expect(concave).toHaveLength(40);
    const concaveDent = segmentsWithPrefix(concave, 'concave_edge_2_');
    expect(concaveDent).toHaveLength(8);
    expect(
      Math.max(
        ...segmentPolyline(concaveDent).map((point) =>
          signedDistanceFromLine(point, [20, -10], [0, 0]),
        ),
      ),
    ).toBeGreaterThan(1);
    expect(smooth).toHaveLength(17);
    expect(smooth.filter((segment) => segment.kind === 'arc')).toHaveLength(4);
    expectReflexBlendTurnsIntoPoint(
      segmentsWithPrefix(smooth, 'smooth_round_3_'),
      [0, 0],
    );
    expect(smooth.map((segment) => segment.kind)).not.toEqual(
      concave.map((segment) => segment.kind),
    );
    for (const segments of [ordered, convex, concave, smooth]) {
      expect(segments.at(-1)?.to).toEqual(segments[0].from);
    }
  });

  it('applies supported corner-origin lowering to sketch primitives and booleans', () => {
    const sketches = evalSketches(`
sketch hole = circle(4, origin: corner);
sketch tab = polygon([(0, 0), (14, 0), (14, 8), (0, 8)], corner);
sketch keyhole = hole + rect(2, 6, corner) at (0, 3);
`);

    expect(
      sketches.find((sketch) => sketch.name === 'hole')?.primitive,
    ).toMatchObject({
      kind: 'sketchAt',
      x: 2,
      y: -2,
    });
    expect(
      sketches.find((sketch) => sketch.name === 'tab')?.primitive,
    ).toMatchObject({
      kind: 'sketchAt',
      x: 0,
      y: -8,
    });
    expect(
      sketches.find((sketch) => sketch.name === 'keyhole')?.primitive,
    ).toMatchObject({
      kind: 'sketchBoolean',
      left: { kind: 'sketchAt', x: 2, y: -2 },
      right: {
        kind: 'sketchAt',
        x: 0,
        y: 3,
        primitive: { kind: 'sketchAt', x: 1, y: -3 },
      },
    });
  });
});
