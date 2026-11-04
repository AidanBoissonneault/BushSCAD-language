/**
 * @author Aidan Boissonneault
 * @file compact-primitive-dimensions.test.ts
 * @purpose Tests compact primitive dimensions behavior in the sketch in parser package.
 * @last-edited October 6, 2026
 */

import type { SketchDecl } from '@bushscad/ir';
import { describe, expect, it } from 'vitest';
import { parse } from '../../../src/core/parser.js';

/**
 * Compacts sketch while preserving its values.
 */
function compactSketch(source: string): SketchDecl {
  const result = parse(source, 'compact-dimensions.bscd');
  expect(result.errors.map((error) => error.message)).toEqual([]);
  const sketch = result.ast.statements.find(
    (item): item is SketchDecl => item.kind === 'sketch',
  );
  if (!sketch) throw new Error('Expected sketch declaration');
  return sketch;
}

describe('compact primitive dimensions', () => {
  it('keeps deferred rectangle sizes and exterior dimension offsets', () => {
    const sketch = compactSketch(`
sketch plate = rect(_, 44.384) at (42.796, 22.192);
@plate.bottom = 77.808 at 8 as plate_width;
@(plate.left, origin.y_axis) = 3;
`);
    if (sketch.primitive.kind !== 'sketchAt') {
      throw new Error('Expected placed rectangle');
    }
    const rectangle = sketch.primitive.primitive;
    if (rectangle.kind !== 'rect') throw new Error('Expected rectangle');

    expect(rectangle.dimensionPlaceholders?.width).toBeDefined();
    expect(rectangle.compactDimensions).toMatchObject([
      {
        dimension: 'length',
        target: 'bottom',
        name: 'plate_width',
        offset: { kind: 'number', value: 8 },
      },
      {
        dimension: 'distance',
        target: 'left',
        ref: 'origin.y_axis',
      },
    ]);
    expect(sketch.span.endLine).toBe(4);
  });

  it('owns a compact radius assignment with its circle inside a path', () => {
    const sketch = compactSketch(`
sketch plate = path(
  rect(40, 45),
  circle(2 * (10)) at (15, 35)
);
@plate.radius = 10 at 6 as hole_radius;
`);
    if (sketch.primitive.kind !== 'pathSketch') {
      throw new Error('Expected mixed path sketch');
    }
    const circleItem = sketch.primitive.items.find(
      (item) => item.kind === 'primitive' && item.primitive.kind === 'sketchAt',
    );
    if (circleItem?.kind !== 'primitive') {
      throw new Error('Expected placed circle item');
    }
    const circle = circleItem.primitive;
    if (circle.kind !== 'sketchAt' || circle.primitive.kind !== 'circle') {
      throw new Error('Expected placed circle');
    }

    expect(circle.primitive.compactDimensions).toMatchObject([
      {
        dimension: 'radius',
        target: 'radius',
        property: 'radius',
        value: { kind: 'number', value: 10 },
        offset: { kind: 'number', value: 6 },
        name: 'hole_radius',
      },
    ]);
  });

  it('accepts `_` only as an ordinary unresolved identifier outside primitives', () => {
    const result = parse('var value = _;', 'underscore.bscd');
    expect(result.errors).toEqual([]);
    expect(result.ast.statements[0]).toMatchObject({
      kind: 'var',
      value: { kind: 'identifier', name: '_' },
    });
  });

  it('leaves spatial @ aliases to the existing anchor parser', () => {
    const result = parse(
      'sketch plate = rect(20, 10);\n@plate.mount = @plate.bottom;',
      'alias.bscd',
    );
    expect(result.errors).toEqual([]);
    expect(result.ast.statements).toMatchObject([
      { kind: 'sketch' },
      { kind: 'anchor', name: 'plate.mount' },
    ]);
  });
});
