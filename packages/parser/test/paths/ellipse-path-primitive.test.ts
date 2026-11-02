/**
 * @author Aidan Boissonneault
 * @file ellipse-path-primitive.test.ts
 * @purpose Tests ellipse path primitive behavior in the paths in parser package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import { parse } from '../../src/core/parser.js';

describe('ellipse path primitives', () => {
  it('parses exact placed ellipses among explicit path geometry', () => {
    const result = parse(
      `sketch seal = path(
        ellipse(40, 20) at (5, -2),
        construction axis = line((-20, 0), (20, 0))
      );`,
      'ellipse-path.bscd',
    );
    expect(result.errors).toEqual([]);
    expect(result.ast.statements[0]).toMatchObject({
      kind: 'sketch',
      primitive: {
        kind: 'pathSketch',
        items: [
          {
            kind: 'primitive',
            primitive: {
              kind: 'sketchAt',
              primitive: { kind: 'ellipse' },
            },
          },
          { kind: 'segment' },
        ],
      },
    });
  });

  it('parses construction ellipses as compact path members', () => {
    const result = parse(
      'sketch ellipse_guide = path(construction ellipse(40, 20));',
      'construction-ellipse.bscd',
    );

    expect(result.errors).toEqual([]);
    expect(result.ast.statements[0]).toMatchObject({
      primitive: {
        items: [
          {
            kind: 'primitive',
            construction: true,
            primitive: { kind: 'ellipse' },
          },
        ],
      },
    });
  });
});
