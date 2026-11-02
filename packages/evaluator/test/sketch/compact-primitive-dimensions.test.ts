/**
 * @author Aidan Boissonneault
 * @file compact-primitive-dimensions.test.ts
 * @purpose Tests compact primitive dimensions behavior in the sketch in evaluator package.
 * @last-edited October 6, 2026
 */

import type { IRArcSegment, IRSketch } from '@bushscad/ir';
import { parse } from '@bushscad/parser';
import { resolve } from '@bushscad/resolver';
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/index.js';

/**
 * Evaluates sketch with the current evaluation context.
 */
function evaluateSketch(source: string): IRSketch {
  const parsed = parse(source, 'compact-dimensions.bscd');
  expect(parsed.errors.map((error) => error.message)).toEqual([]);
  const resolved = resolve(
    parsed.ast,
    'compact-dimensions.bscd',
    () => null,
  );
  expect(resolved.errors.map((error) => error.message)).toEqual([]);
  const evaluated = evaluate(resolved.ast);
  expect(evaluated.errors.map((error) => error.message)).toEqual([]);
  const sketch = evaluated.program.ops.find(
    (item): item is IRSketch => item.kind === 'sketch',
  );
  if (!sketch) throw new Error('Expected evaluated sketch');
  return sketch;
}

describe('compact primitive dimension evaluation', () => {
  it('evaluates deferred size expressions and persistent label spacing', () => {
    const sketch = evaluateSketch(`
var width = 77.808;
sketch plate = rect(_, 44.384, left: datum) at (42.796, 22.192);
@plate.bottom = width at 9;
@(plate.datum, origin.y_axis) = 3;
`);

    expect(sketch.primitive).toMatchObject({
      kind: 'sketchAt',
      x: 42.796,
      y: 22.192,
      primitive: {
        kind: 'rect',
        width: 77.808,
        height: 44.384,
        dimensions: [
          {
            mode: 'driving',
            dimension: 'length',
            target: 'bottom',
            value: 77.808,
            labelOffset: 9,
          },
          {
            mode: 'driving',
            dimension: 'distance',
            target: 'datum',
            ref: 'origin.y_axis',
            value: 3,
          },
        ],
      },
    });
  });

  it('keeps dimensions on a primitive inside a mixed construction path', () => {
    const sketch = evaluateSketch(`
sketch plate = path(
  rect(_, 40) at (40, 20),
  construction center = line((0, 20), (80, 20))
);
@plate.bottom = 80;
`);

    expect(sketch.primitive).toMatchObject({
      kind: 'profile',
      dimensions: [
        {
          mode: 'driving',
          dimension: 'length',
          target: 'bottom',
          value: 80,
        },
      ],
    });
  });

  it('evaluates a circle radius assignment inside a mixed primitive path', () => {
    const sketch = evaluateSketch(`
sketch plate = path(
  rect(40, 45),
  circle(2 * (10)) at (15, 35)
);
@plate.radius = 10 at 6 as hole_radius;
`);

    expect(sketch.primitive).toMatchObject({
      kind: 'profile',
      dimensions: [
        {
          name: 'hole_radius',
          mode: 'driving',
          dimension: 'radius',
          target: 'circle_2_q1',
          property: 'radius',
          value: 10,
          labelOffset: 6,
        },
      ],
    });
    const circleArcs =
      sketch.primitive.kind === 'profile'
        ? sketch.primitive.segments.filter(
            (segment): segment is IRArcSegment =>
              segment.kind === 'arc' && segment.name.startsWith('circle_2_'),
          )
        : [];
    expect(circleArcs).toHaveLength(4);
    expect(circleArcs.every((segment) => segment.radius === 10)).toBe(true);
  });
});
