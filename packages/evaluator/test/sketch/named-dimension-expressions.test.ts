/**
 * @author Aidan Boissonneault
 * @file named-dimension-expressions.test.ts
 * @purpose Tests named dimension expressions behavior in the sketch in evaluator package.
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

describe('named sketch dimension expressions', () => {
  it('solves a forward reference with outer values, units, and arithmetic', () => {
    const sketch = expectProfileSketch(
      opsOfKind<IRSketch>(
        evalOps(`
var allowance = 5mm;
sketch profile = path(
  reference = line((0, 0), (10, 0)),
  driven = line((0, 8), (12, 9)),
  constraint(reference.start, fixed),
  constraint(reference.end, fixed),
  constraint(driven.start, fixed),
  constraint(driven, horizontal),
  constraint(driven, length, reference_length + allowance, at: (8, 12)) as driven_length,
  dimension reference.length at (5, -4) as reference_length
);`),
        'sketch',
      )[0],
    );

    expect(sketch.primitive.segments[1].to).toEqual(
      expect.arrayContaining([expect.closeTo(15, 5), expect.closeTo(8, 5)]),
    );
    expect(sketch.primitive.dimensions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'driven_length',
          value: expect.closeTo(15, 5),
        }),
        expect.objectContaining({ name: 'reference_length', value: 10 }),
      ]),
    );
    expect(sketch.primitive.constraints).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'driven_length',
          constraint: 'length',
          value: expect.closeTo(15, 5),
          span: expect.objectContaining({ file: expect.any(String) }),
        }),
      ]),
    );
  });

  it('solves midpoint and measures an angle from the Y axis', () => {
    const sketch = expectProfileSketch(
      opsOfKind<IRSketch>(
        evalOps(`
sketch profile = path(
  base = line((0, 0), (20, 0)),
  marker = line((0, 10), (8, 2)),
  constraint(base.start, fixed),
  constraint(base.end, fixed),
  constraint(marker.start, fixed),
  constraint(marker.end, midpoint, base),
  dimension marker.angle to origin.y_axis at (4, 8) as marker_angle
);`),
        'sketch',
      )[0],
    );

    expect(sketch.primitive.segments[1].to[0]).toBeCloseTo(10, 5);
    expect(sketch.primitive.segments[1].to[1]).toBeCloseTo(0, 5);
    expect(sketch.primitive.constraints).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ constraint: 'midpoint', ref: 'base' }),
      ]),
    );
    expect(sketch.primitive.dimensions?.at(-1)).toMatchObject({
      name: 'marker_angle',
      dimension: 'angle',
      ref: 'origin.y_axis',
    });
  });

  it('solves arc radius drivers and emits their measured metadata', () => {
    const sketch = expectProfileSketch(
      opsOfKind<IRSketch>(
        evalOps(`
sketch profile = path(
  curve = arc((0, 0), (20, 0), 11, ccw),
  constraint(curve.start, fixed),
  constraint(curve.end, fixed),
  constraint(curve, radius, 12, at: (10, 8)) as curve_radius,
  dimension curve.diameter at (10, 14) as curve_diameter
);`),
        'sketch',
      )[0],
    );

    expect(sketch.primitive.segments[0].kind).toBe('arc');
    if (sketch.primitive.segments[0].kind === 'arc') {
      expect(sketch.primitive.segments[0].radius).toBeCloseTo(12, 5);
    }
    expect(sketch.primitive.dimensions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'curve_radius', value: 12 }),
        expect.objectContaining({
          name: 'curve_diameter',
          value: expect.closeTo(24, 5),
        }),
      ]),
    );
  });

  it('solves and measures point-distance Cartesian components', () => {
    const sketch = expectProfileSketch(
      opsOfKind<IRSketch>(
        evalOps(`
sketch profile = path(
  base = line((0, 0), (10, 0)),
  marker = line((5, 5), (13, 9)),
  constraint(base.start, fixed),
  constraint(marker.start, fixed),
  constraint(marker.end, distance, base.start, 25, axis: x, at: (12, 14)) as horizontal_span,
  dimension marker.start.distance to marker.end axis: y at (22, 7) as rise
);`),
        'sketch',
      )[0],
    );

    expect(sketch.primitive.segments[1].to[0]).toBeCloseTo(25, 5);
    expect(sketch.primitive.dimensions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'horizontal_span',
          axis: 'x',
          value: expect.closeTo(25, 5),
        }),
        expect.objectContaining({
          name: 'rise',
          axis: 'y',
          value: expect.closeTo(4, 5),
        }),
      ]),
    );
    expect(sketch.primitive.constraints).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'horizontal_span',
          axis: 'x',
          value: expect.closeTo(25, 5),
        }),
      ]),
    );
  });

  it('reports unsupported local-dimension expression forms', () => {
    const errors = evalErrorMessages(`
sketch profile = path(
  base = line((0, 0), (10, 0)),
  side = line((0, 5), (8, 5)),
  dimension base.length at (5, -4) as base_length,
  constraint(side, length, base_length > 2 ? base_length : 2)
);`);

    expect(errors).toContain(
      'Sketch dimension references support numeric literals, units, and +, -, *, /, or % arithmetic',
    );
  });

  it('reports live dimension division by zero at the driving expression', () => {
    const errors = evalErrorMessages(`
sketch profile = path(
  base = line((0, 0), (10, 0)),
  side = line((0, 5), (8, 5)),
  constraint(base.start, fixed),
  constraint(base.end, fixed),
  constraint(side.start, fixed),
  dimension base.length at (5, -4) as base_length,
  constraint(side, length, base_length / (base_length - base_length))
);`);

    expect(errors).toContain(
      'Sketch dimension expression evaluated to a non-finite value (division by zero or invalid measurement)',
    );
  });
});
