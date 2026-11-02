/**
 * @author Aidan Boissonneault
 * @file named-sketch-dimensions.test.ts
 * @purpose Tests named sketch dimensions behavior in the sketch in parser package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import type { SketchDecl } from '@bushscad/ir';
import { parse } from '../../src/core/parser.js';

/**
 * Builds the path data required by the current operation.
 */
function pathPrimitive(source: string) {
  const result = parse(source, 'named-dimensions.bscd');
  expect(result.errors.map((error) => error.message)).toEqual([]);
  const sketch = result.ast.statements.find(
    (item): item is SketchDecl => item.kind === 'sketch',
  );
  if (sketch?.primitive.kind !== 'pathSketch') {
    throw new Error('Expected path sketch');
  }
  return sketch.primitive;
}

describe('named sketch dimensions', () => {
  it('parses trailing names and dimension references in driving expressions', () => {
    const path = pathPrimitive(`
sketch profile = path(
  base = line((0, 0), (20, 0)),
  side = line((20, 10)),
  dimension base.length at (10, -5) as base_length,
  constraint(side, length, base_length / 2, at: (24, 5)) as side_length
);`);

    expect(path.dimensions[0]).toMatchObject({ name: 'base_length' });
    expect(path.constraints[0]).toMatchObject({
      name: 'side_length',
      constraint: 'length',
    });
    expect(path.constraints[0].value).toMatchObject({
      kind: 'binary',
      op: '/',
    });
  });

  it('parses midpoint and origin-axis angle constraints', () => {
    const path = pathPrimitive(`
sketch profile = path(
  base = line((0, 0), (20, 0)),
  marker = line((5, 5), (10, 2)),
  constraint(marker.end, midpoint, base),
  constraint(marker, angle, origin.y_axis, 30deg)
);`);

    expect(path.constraints).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          constraint: 'midpoint',
          target: 'marker.end',
          ref: 'base',
        }),
        expect.objectContaining({
          constraint: 'angle',
          ref: 'origin.y_axis',
        }),
      ]),
    );
  });

  it('parses horizontal and vertical point-distance dimensions', () => {
    const path = pathPrimitive(`
sketch profile = path(
  base = line((0, 0), (20, 10)),
  constraint(base.start, distance, base.end, 30, axis: x, at: (10, -5)) as width,
  dimension base.start.distance to base.end axis: y at (25, 5) as height
);`);

    expect(path.constraints[0]).toMatchObject({
      constraint: 'distance',
      axis: 'x',
      name: 'width',
    });
    expect(path.dimensions[0]).toMatchObject({
      dimension: 'distance',
      axis: 'y',
      name: 'height',
    });
  });

  it('parses horizontal and vertical point-pair constraints', () => {
    const path = pathPrimitive(`
sketch profile = path(
  base = line((0, 0), (20, 10)),
  marker = line((4, 6), (8, 12)),
  constraint(marker.start, horizontal, base.end),
  constraint(marker.end, vertical, base.start)
);`);

    expect(path.constraints).toMatchObject([
      {
        constraint: 'horizontal',
        target: 'marker.start',
        ref: 'base.end',
      },
      {
        constraint: 'vertical',
        target: 'marker.end',
        ref: 'base.start',
      },
    ]);
  });
});
