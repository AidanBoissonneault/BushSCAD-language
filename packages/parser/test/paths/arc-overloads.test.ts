/**
 * @author Aidan Boissonneault
 * @file arc-overloads.test.ts
 * @purpose Checks the supported path-local arc overloads in parser package.
 * @last-edited November 4, 2026
 */

import { describe, expect, it } from 'vitest';
import { parse } from '../../src/core/parser.js';

describe('path arc overloads', () => {
  it('infers a semicircle from two endpoint tuples', () => {
    const result = parse(
      'sketch curve = path(arc((0, 0), (10, 0)));',
      'arc-semicircle.bscd',
    );

    expect(result.errors).toEqual([]);
    expect(result.ast.statements[0]).toMatchObject({
      primitive: {
        items: [
          {
            segment: {
              kind: 'arc',
              form: 'explicit',
              start: [
                { kind: 'number', value: 0 },
                { kind: 'number', value: 0 },
              ],
              end: [
                { kind: 'number', value: 10 },
                { kind: 'number', value: 0 },
              ],
              direction: 'ccw',
            },
          },
        ],
      },
    });
    const statement = result.ast.statements[0];
    if (
      statement.kind !== 'sketch' ||
      statement.primitive.kind !== 'pathSketch'
    )
      throw new Error('Expected a path sketch');
    expect(statement.primitive.items[0]).toMatchObject({
      kind: 'segment',
      segment: { radius: undefined },
    });
  });

  it('accepts two endpoint tuples with an unlabeled radius', () => {
    const result = parse(
      'sketch curve = path(arc((0, 0), (10, 0), 8));',
      'arc-radius.bscd',
    );

    expect(result.errors).toEqual([]);
    expect(result.ast.statements[0]).toMatchObject({
      primitive: {
        items: [
          {
            segment: {
              kind: 'arc',
              radius: { kind: 'number', value: 8 },
              direction: 'ccw',
            },
          },
        ],
      },
    });
  });

  it('allows labels for explicit endpoints, radius, and direction', () => {
    const result = parse(
      'sketch curve = path(arc(start: (0, 0), end: (10, 0), radius: 8, direction: cw));',
      'arc-named.bscd',
    );

    expect(result.errors).toEqual([]);
    expect(result.ast.statements[0]).toMatchObject({
      primitive: {
        items: [
          {
            segment: {
              kind: 'arc',
              radius: { kind: 'number', value: 8 },
              direction: 'cw',
            },
          },
        ],
      },
    });
  });

  it('rejects duplicate endpoint aliases and invalid labeled directions', () => {
    const result = parse(
      'sketch curve = path(arc(start: (0, 0), from: (1, 1), (10, 0), direction: sideways));',
      'arc-invalid-labels.bscd',
    );

    expect(result.errors.map((error) => error.message)).toEqual(
      expect.arrayContaining([
        "arc() got duplicate argument 'start'",
        "arc() direction must be 'cw' or 'ccw'",
      ]),
    );
  });
});
