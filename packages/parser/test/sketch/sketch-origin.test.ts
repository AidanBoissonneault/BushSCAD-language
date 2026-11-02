/**
 * @author Aidan Boissonneault
 * @file sketch-origin.test.ts
 * @purpose Tests sketch origin behavior in the sketch in parser package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import type { SketchDecl } from '@bushscad/ir';
import { parse } from '../../src/core/parser.js';

/**
 * Parses ok from the supplied source into the sketch representation.
 */
function parseOk(source: string) {
  const result = parse(source, 'sketch-origin.bscd');
  expect(result.errors.map((error) => error.message)).toEqual([]);
  return result.ast.statements as SketchDecl[];
}

describe('sketch origin parsing', () => {
  it('parses named and bare origins on built-in sketch primitives', () => {
    const sketches = parseOk(
      [
        'sketch a = rect(60, 40, corner);',
        'sketch b = circle(10, origin: corner);',
        'sketch c = roundrect(60, 40, 4, corner);',
        'sketch d = triangle(30, 20, origin: corner);',
        'sketch e = polygon([(0, 0), (10, 0), (5, 8)], corner);',
        "sketch f = word('A', size: 8, origin: corner);",
      ].join('\n'),
    );

    const origins = sketches.map((sketch) =>
      'origin' in sketch.primitive ? sketch.primitive.origin : undefined,
    );
    expect(origins).toEqual([
      'corner',
      'corner',
      'corner',
      'corner',
      'corner',
      'corner',
    ]);
  });

  it('rejects block-style profile sketches', () => {
    const result = parse(
      'sketch p = { line edge from (0, 0) to (10, 0); };',
      'sketch-origin.bscd',
    );

    expect(result.errors.map((error) => error.message)).toContain(
      'Block-style sketch profiles are no longer supported; use path(...).',
    );
  });

  it('reports invalid and duplicate origins', () => {
    const result = parse(
      [
        'sketch a = rect(10, 10, origin: middle);',
        'sketch b = circle(10, origin: corner, corner);',
      ].join('\n'),
      'sketch-origin-errors.bscd',
    );

    expect(result.errors.map((error) => error.message)).toEqual(
      expect.arrayContaining([
        'rect() origin must be center or corner',
        "circle() got duplicate argument 'origin'",
      ]),
    );
  });
});
