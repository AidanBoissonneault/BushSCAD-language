/**
 * @author Aidan Boissonneault
 * @file rect-side-names.test.ts
 * @purpose Tests rect side names behavior in the sketch in parser package.
 * @last-edited October 6, 2026
 */

import type { SketchDecl } from '@bushscad/ir';
import { describe, expect, it } from 'vitest';
import { parse } from '../../../../src/index.js';
import { parseOk } from '../../../fixtures/parse.js';

/**
 * Handles parsed rect in the sketch flow.
 */
function parsedRect(source: string) {
  const ast = parseOk(source);
  const sketch = ast.statements[0] as SketchDecl;
  expect(sketch.primitive.kind).toBe('rect');
  if (sketch.primitive.kind !== 'rect') {
    throw new Error('Expected a rectangle primitive');
  }
  return sketch.primitive;
}

/**
 * Parses messages from the supplied source into the sketch representation.
 */
function parseMessages(source: string): string[] {
  return parse(source, 'rect-side-names.test.bscd').errors.map(
    (error) => error.message,
  );
}

describe('rectangle side names', () => {
  it('stores bare identifier aliases as rectangle metadata', () => {
    const rectangle = parsedRect(`
sketch plate = rect(
  80,
  40,
  bottom: mount_edge,
  right: outer_wall,
  top: cap_edge,
  left: inner_wall
);
`);

    expect(rectangle.sideNames).toEqual({
      bottom: 'mount_edge',
      right: 'outer_wall',
      top: 'cap_edge',
      left: 'inner_wall',
    });
  });

  it('accepts aliases that swap canonical names when effective names differ', () => {
    const rectangle = parsedRect(
      'sketch plate = rect(80, 40, bottom: right, right: bottom);',
    );

    expect(rectangle.sideNames).toEqual({ bottom: 'right', right: 'bottom' });
  });

  it('requires alias values to be bare identifiers', () => {
    expect(
      parseMessages('sketch plate = rect(80, 40, bottom: edge_name + 1);'),
    ).toContain("rect() argument 'bottom' must be a bare identifier");
  });

  it('rejects collisions between aliases and unchanged side names', () => {
    expect(
      parseMessages('sketch plate = rect(80, 40, bottom: right);'),
    ).toContain(
      "rect() side names must be unique; 'right' names both 'bottom' and 'right'",
    );
  });

  it('rejects duplicate aliases on different sides', () => {
    expect(
      parseMessages(
        'sketch plate = rect(80, 40, bottom: mount_edge, top: mount_edge);',
      ),
    ).toContain(
      "rect() side names must be unique; 'mount_edge' names both 'bottom' and 'top'",
    );
  });
});
