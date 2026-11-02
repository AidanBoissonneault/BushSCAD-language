/**
 * @author Aidan Boissonneault
 * @file m40-optional-keyword-args.test.ts
 * @purpose Tests m40 optional keyword args behavior in the statements in parser package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import type { PartDecl, SketchDecl } from '@bushscad/ir';
import { parse } from '../../src/core/parser.js';

/**
 * Parses ok from the supplied source into the statements representation.
 */
function parseOk(source: string) {
  const result = parse(source, 'm40.bscd');
  expect(result.errors).toEqual([]);
  return result.ast;
}

describe('M40 optional keyword arguments', () => {
  it('parses named and mixed sketch primitive value arguments', () => {
    const ast = parseOk(
      [
        'sketch a = rect(width: 60, height: 40);',
        'sketch b = rect(60, height: 40, r: 2);',
        'sketch c = circle(diameter: 10);',
        'sketch d = roundrect(50, height: 30, radius: 4);',
        'sketch e = triangle(base: 12, height: 8);',
      ].join('\n'),
    );

    const sketches = ast.statements as SketchDecl[];
    expect(sketches.map((stmt) => stmt.primitive.kind)).toEqual([
      'rect',
      'rect',
      'circle',
      'roundrect',
      'triangle',
    ]);
  });

  it('parses object depth, pos, grid, range, and radial mixed arguments', () => {
    const ast = parseOk(`
part p {
  sketch base = rect(60, 40);
  obj base = extrude(base, depth: 10);
  sketch hole = circle(4);
  obj hole = cut(hole, depth: 2 , @base.top(10, y: 15));
  for (i, j) in grid(4, rows: 3) { sketch h = circle(1); }
  for k in range(count: 4, step: 1) { sketch r = circle(1); }
  for a in radial(4, sweep: 180deg) { sketch q = circle(1); }
}`);

    const part = ast.statements[0] as PartDecl;
    const cut = part.body.statements.find(
      (stmt) => stmt.kind === 'obj' && stmt.operation.kind === 'cut',
    );
    if (!cut || cut.kind !== 'obj' || cut.operation.kind !== 'cut') {
      throw new Error('expected cut op');
    }
    expect(cut.operation.from?.kind).toBe('pos');
  });

  it('reports duplicate, unknown, missing, and too many value arguments', () => {
    const result = parse(
      [
        'sketch a = rect(width: 1, width: 2, height: 3);',
        'sketch b = circle(color: 10);',
        'sketch c = triangle(1);',
        'sketch d = roundrect(1, 2, 3, 4);',
      ].join('\n'),
      'm40-errors.bscd',
    );

    expect(result.errors.map((error) => error.message)).toEqual(
      expect.arrayContaining([
        "rect() got duplicate argument 'width'",
        "circle() does not accept argument 'color'",
        "triangle() requires argument 'height'",
        'roundrect() accepts at most 3 positional argument(s)',
      ]),
    );
  });
});
