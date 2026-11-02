/**
 * @author Aidan Boissonneault
 * @file place-origin.test.ts
 * @purpose Tests place origin behavior in the geometry in parser package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import type { PartDecl, PlaceStatement, Program } from '@bushscad/ir';
import { parse } from '../../src/core/parser.js';

/**
 * Parses ok from the supplied source into the geometry representation.
 */
function parseOk(src: string): Program {
  const result = parse(src, 'test.bscd');
  expect(
    result.errors,
    `parse errors: ${result.errors.map((error) => error.message).join(', ')}`,
  ).toHaveLength(0);
  return result.ast;
}

/**
 * Returns the first place that matches the requested condition.
 */
function firstPlace(ast: Program): PlaceStatement {
  const part = ast.statements.find(
    (stmt): stmt is PartDecl => stmt.kind === 'part',
  );
  const place = part?.body.statements.find(
    (stmt): stmt is PlaceStatement => stmt.kind === 'place',
  );
  if (!place) throw new Error('Expected a place statement');
  return place;
}

describe('place origin overload parsing', () => {
  it('parses place(component) at top level', () => {
    const ast = parseOk('place(body);');
    const place = ast.statements.find(
      (stmt): stmt is PlaceStatement => stmt.kind === 'place',
    );

    expect(place?.component).toBe('body');
    expect(place?.target).toBeNull();
  });

  it('parses place(component) without a target', () => {
    const ast = parseOk('part p { place(body); }');
    const place = firstPlace(ast);

    expect(place.component).toBe('body');
    expect(place.target).toBeNull();
    expect(place.sourceAnchor).toBeNull();
  });

  it('parses place-time rotation on origin placement', () => {
    const ast = parseOk('part p { place(body) rotateZ(45deg); }');
    const place = firstPlace(ast);

    expect(place.target).toBeNull();
    expect(place.rotate).toMatchObject({ kind: 'axes' });
  });
});
