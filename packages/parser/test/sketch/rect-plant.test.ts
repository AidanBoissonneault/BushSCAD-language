/**
 * @author Aidan Boissonneault
 * @file rect-plant.test.ts
 * @purpose Tests rect plant behavior in the sketch in parser package.
 * @last-edited October 6, 2026
 */

import type { RectPrimitive, RectSide, SketchDecl } from '@bushscad/ir';
import { describe, expect, it } from 'vitest';
import { parse } from '../../src/index.js';
import { parseOk } from '../fixtures/parse.js';

/**
 * Handles parsed sketch in the sketch flow.
 */
function parsedSketch(source: string): SketchDecl {
  return parseOk(source).statements[0] as SketchDecl;
}

/**
 * Handles underlying rectangle in the sketch flow.
 */
function underlyingRectangle(sketch: SketchDecl): RectPrimitive {
  let primitive = sketch.primitive;
  while (primitive.kind === 'sketchAt') primitive = primitive.primitive;
  expect(primitive.kind).toBe('rect');
  if (primitive.kind !== 'rect') throw new Error('Expected a rectangle');
  return primitive;
}

/**
 * Parses messages from the supplied source into the sketch representation.
 */
function parseMessages(source: string): string[] {
  return parse(source, 'rect-plant.test.bscd').errors.map(
    ({ message }) => message,
  );
}

describe('rectangle plant suffix', () => {
  it.each<RectSide>(['bottom', 'right', 'top', 'left'])(
    'selects the canonical %s side',
    (side) => {
      const sketch = parsedSketch(`sketch plate = rect(40, 20) plant ${side};`);

      expect(underlyingRectangle(sketch).plant).toBe(side);
    },
  );

  it('selects a rectangle beneath local placement', () => {
    const sketch = parsedSketch(
      'sketch plate = rect(40, 20) at (28, 16) plant bottom;',
    );

    expect(sketch.primitive).toMatchObject({
      kind: 'sketchAt',
      primitive: { kind: 'rect', plant: 'bottom' },
    });
  });

  it('preserves the existing bare polygon plant suffix', () => {
    const sketch = parsedSketch(
      'sketch profile = polygon([(0, 0), (10, 0), (0, 10)]) plant;',
    );

    expect(sketch.primitive).toMatchObject({ kind: 'polygon', plant: true });
  });

  it('rejects plant on a primitive without canonical sides', () => {
    expect(parseMessages('sketch hole = circle(10) plant bottom;')).toContain(
      'plant can only follow polygon sketches or select a rectangle side',
    );
  });

  it('rejects an unknown rectangle side', () => {
    expect(parseMessages('sketch plate = rect(40, 20) plant front;')).toContain(
      "Invalid rectangle plant side 'front'. Expected: bottom, right, top, left",
    );
  });

  it('requires a rectangle side after the plant keyword', () => {
    expect(parseMessages('sketch plate = rect(40, 20) plant;')).toEqual([
      'Rectangle plant requires one of: bottom, right, top, left',
    ]);
    expect(parseMessages('sketch plate = rect(40, 20) plant circle;')).toEqual([
      'Rectangle plant requires one of: bottom, right, top, left',
    ]);
  });
});
