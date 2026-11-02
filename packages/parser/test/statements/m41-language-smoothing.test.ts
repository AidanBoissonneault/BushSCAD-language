/**
 * @author Aidan Boissonneault
 * @file m41-language-smoothing.test.ts
 * @purpose Tests m41 language smoothing behavior in the statements in parser package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import type { ObjDecl, PartDecl, SurfaceDecl } from '@bushscad/ir';
import { parse } from '../../src/core/parser.js';

/**
 * Parses ok from the supplied source into the statements representation.
 */
function parseOk(source: string) {
  const result = parse(source, 'm41.bscd');
  expect(result.errors).toEqual([]);
  return result.ast;
}

describe('M41 language expectation smoothing parser', () => {
  it('parses inline sketch, path, surface, and inferred through operands', () => {
    const ast = parseOk(`
part p {
  sketch rail_profile = circle(3);
  obj base = extrude(rect(60, 40), 10);
  obj hole = cut(circle(4), through , @base.top(10, 15));
  obj swept = sweep(circle(3) along polyline([(0, 0, 0), (0, 0, 30)]));
  surface cap = offset_surface(fill(base.top), 1);
  obj skin = thicken(fill(base.top), 1);
}`);

    const part = ast.statements[0] as PartDecl;
    const [base, hole, swept] = part.body.statements.filter(
      (stmt): stmt is ObjDecl => stmt.kind === 'obj',
    );
    const surface = part.body.statements.find(
      (stmt): stmt is SurfaceDecl => stmt.kind === 'surface',
    );

    expect(base.operation.kind).toBe('extrude');
    if (base.operation.kind === 'extrude') {
      expect(base.operation.sketch.kind).toBe('inlineSketch');
    }
    expect(hole.operation.kind).toBe('cut');
    if (hole.operation.kind === 'cut') {
      expect(hole.operation.through?.kind).toBe('inferredThrough');
      expect(hole.operation.sketch.kind).toBe('inlineSketch');
    }
    expect(swept.operation.kind).toBe('sweep');
    if (swept.operation.kind === 'sweep') {
      expect(swept.operation.path.kind).toBe('inlinePath');
    }
    expect(surface?.operation.kind).toBe('offset_surface');
    if (surface?.operation.kind === 'offset_surface') {
      expect(surface.operation.surface.kind).toBe('inlineSurface');
    }
  });

  it('keeps bare within identifiers as numeric expressions', () => {
    const ast = parseOk(`
part p {
  var span = 120;
  for i in range(4) within span {
    sketch h = circle(4);
  }
}`);
    const part = ast.statements[0] as PartDecl;
    const loop = part.body.statements.find((stmt) => stmt.kind === 'for');
    expect(loop?.kind).toBe('for');
    if (loop?.kind === 'for') {
      expect(loop.within?.dims[0].kind).toBe('expr');
    }
  });
});
