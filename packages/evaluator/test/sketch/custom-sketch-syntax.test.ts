/**
 * @author Aidan Boissonneault
 * @file custom-sketch-syntax.test.ts
 * @purpose Tests custom sketch syntax behavior in the sketch in evaluator package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import type { IRSketch } from '@bushscad/ir';
import {
  evalErrorMessages,
  evalOps,
  expectProfileSketch,
  opsOfKind,
} from '../core/test-support.js';

/**
 * Asserts the expected point close behavior in this test.
 */
function expectPointClose(
  point: [number, number],
  expected: [number, number],
): void {
  expect(point[0]).toBeCloseTo(expected[0], 5);
  expect(point[1]).toBeCloseTo(expected[1], 5);
}

describe('custom sketch syntax evaluation', () => {
  it('lowers path cursor syntax to named profile segments', () => {
    const ops = evalOps(`
sketch profile = path(
  plant foot = line((6, 0), (18, 0)),
  wall = line((16, 32)),
  lip = arc((12, 36), 4, ccw),
  inner = line(8, 4),
  heel = arc((8, 4), (6, 0), 4, ccw)
);
`);

    const sketch = expectProfileSketch(opsOfKind<IRSketch>(ops, 'sketch')[0]);
    expect(sketch.primitive.segments.map((segment) => segment.name)).toEqual([
      'foot',
      'wall',
      'lip',
      'inner',
      'heel',
    ]);
    expect(sketch.primitive.segments[1]).toMatchObject({
      from: [18, 0],
      to: [16, 32],
    });
    expect(sketch.primitive.segments[0]).toMatchObject({ plant: true });
  });

  it('lowers wrap to a closed profile and supports convex mode', () => {
    const ops = evalOps(`
sketch hull = wrap([
  (-20, -10),
  (20, -10),
  (0, 0),
  (20, 10),
  (-20, 10)
], convex);
`);

    const sketch = expectProfileSketch(opsOfKind<IRSketch>(ops, 'sketch')[0]);
    expect(sketch.primitive.segments).toHaveLength(32);
    expect(sketch.primitive.wrap).toMatchObject({
      mode: 'convex',
      points: [
        [-20, -10],
        [20, -10],
        [0, 0],
        [20, 10],
        [-20, 10],
      ],
    });
    expect(sketch.primitive.segments.at(-1)?.to).toEqual(
      sketch.primitive.segments[0].from,
    );
  });

  it('solves constraints declared inside path sketches', () => {
    const ops = evalOps(`
sketch plate = path(
  plant bottom = line((0, 0), (78, 2)),
  right = line((82, 39)),
  top = line((1, 43)),
  left = close(),
  constraint(bottom.start, fixed),
  constraint(bottom, horizontal),
  constraint(right, vertical),
  constraint(top, horizontal),
  constraint(left, vertical),
  constraint(bottom, length, 80),
  constraint(right, length, 40)
);
`);

    const sketch = expectProfileSketch(opsOfKind<IRSketch>(ops, 'sketch')[0]);
    expect(sketch.primitive.constraintState?.status).toBe('fully-constrained');
    expectPointClose(sketch.primitive.segments[0].from, [0, 0]);
    expectPointClose(sketch.primitive.segments[0].to, [80, 0]);
    expectPointClose(sketch.primitive.segments[1].from, [80, 0]);
    expectPointClose(sketch.primitive.segments[1].to, [80, 40]);
  });

  it('solves endpoint distance dimensions declared inside path sketches', () => {
    const ops = evalOps(`
sketch span = path(
  plant base = line((0, 0), (18, 0)),
  constraint(base.start, fixed),
  constraint(base, horizontal),
  constraint(base.start, distance, base.end, 25)
);
`);

    const sketch = expectProfileSketch(opsOfKind<IRSketch>(ops, 'sketch')[0]);
    expectPointClose(sketch.primitive.segments[0].from, [0, 0]);
    expectPointClose(sketch.primitive.segments[0].to, [25, 0]);
  });

  it('preserves reference dimensions without modifying solved geometry', () => {
    const ops = evalOps(`
sketch span = path(
  plant base = line((0, 0), (18, 0)),
  constraint(base.start, fixed),
  constraint(base, horizontal),
  constraint(base, length, 25, (12.5, -6)),
  dimension base.length at (12.5, -12)
);
`);

    const sketch = expectProfileSketch(opsOfKind<IRSketch>(ops, 'sketch')[0]);
    expectPointClose(sketch.primitive.segments[0].to, [25, 0]);
    expect(sketch.primitive.dimensions?.[0]).toMatchObject({
      mode: 'driving',
      dimension: 'length',
      value: 25,
      label: [12.5, -6],
    });
    expect(sketch.primitive.dimensions?.[1]).toMatchObject({
      mode: 'reference',
      dimension: 'length',
      label: [12.5, -12],
    });
    expect(sketch.primitive.dimensions?.[1]?.value).toBeCloseTo(25, 5);
  });

  it('solves and measures origin and axis distance dimensions', () => {
    const ops = evalOps(`
sketch anchored = path(
  plant base = line((5, 8), (20, 8)),
  constraint(base.start, distance, origin.y_axis, 12),
  constraint(base.start, distance, origin.x_axis, 6),
  dimension base.start.distance to origin at (6, -4)
);
`);

    const sketch = expectProfileSketch(opsOfKind<IRSketch>(ops, 'sketch')[0]);
    expectPointClose(sketch.primitive.segments[0].from, [12, 6]);
    expect(sketch.primitive.dimensions?.[0]).toMatchObject({
      mode: 'reference',
      dimension: 'distance',
      ref: 'origin',
    });
    expect(sketch.primitive.dimensions?.[0]?.value).toBeCloseTo(
      Math.hypot(12, 6),
      5,
    );
  });

  it('reports underconstrained path constraints', () => {
    const ops = evalOps(`
sketch loose = path(
  bottom = line((0, 0), (20, 0)),
  side = line((20, 10)),
  close(),
  constraint(bottom, horizontal)
);
`);

    const sketch = expectProfileSketch(opsOfKind<IRSketch>(ops, 'sketch')[0]);
    expect(sketch.primitive.constraintState?.status).toBe('underconstrained');
  });

  it('marks construction path segments and exact primitive edits', () => {
    const ops = evalOps(`
sketch guide_sketch = path(
  construction center = line((0, 0), (40, 0)),
  plant edge = line((0, 5), (40, 5))
);
sketch padded = offset(rect(20, 10), 2);
sketch rounded = fillet(rect(20, 10), 3);
sketch exact_circle = ellipse(12, 12);
sketch exact_ellipse = ellipse(20, 10);
`);

    const sketches = opsOfKind<IRSketch>(ops, 'sketch');
    const guide = expectProfileSketch(sketches[0]);
    expect(guide.primitive.segments[0]).toMatchObject({
      construction: true,
    });
    expect(sketches[1].primitive).toMatchObject({
      kind: 'rect',
      width: 24,
      height: 14,
    });
    expect(sketches[2].primitive).toMatchObject({
      kind: 'roundrect',
      width: 20,
      height: 10,
      radius: 3,
    });
    expect(sketches[3].primitive).toMatchObject({
      kind: 'circle',
      diameter: 12,
    });
    expect(sketches[4].primitive).toMatchObject({
      kind: 'ellipse',
      width: 20,
      height: 10,
    });
  });

  it('diagnoses advanced sketch operations without exact geometry', () => {
    const messages = evalErrorMessages(`
sketch curve = spline([(0, 0), (10, 5), (20, 0)]);
sketch projected = project(@body.top.edges);
`);

    expect(messages).toEqual(
      expect.arrayContaining([
        'spline(...) exact sketch support currently requires exactly two points.',
        'project(...) is recognized but has no exact sketch geometry implementation yet.',
      ]),
    );
  });

  it('reports invalid path usage and open solid profiles', () => {
    const messages = evalErrorMessages(`
sketch bad = path(
  line(20, 0),
  line(20, 10)
);
obj body = extrude(bad, 5);
`);

    expect(messages).toEqual(
      expect.arrayContaining([
        'The first segment in path() must establish a start point. Use line((x1, y1), (x2, y2)) for the first segment.',
        "Sketch 'bad' is open and cannot be extruded as a solid. Use close() or wrap() to create a closed profile.",
      ]),
    );
  });
});
