/**
 * @author Aidan Boissonneault
 * @file named-sketch-dimensions.test.ts
 * @purpose Tests named sketch dimensions behavior in the sketch in resolver package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import { parse } from '@bushscad/parser';
import { resolve } from '../../src/index.js';

/**
 * Handles errors for in the sketch flow.
 */
function errorsFor(source: string): string[] {
  const parsed = parse(source, 'named-dimensions.bscd');
  expect(parsed.errors.map((error) => error.message)).toEqual([]);
  return resolve(
    parsed.ast,
    'named-dimensions.bscd',
    () => null,
  ).errors.map((error) => error.message);
}

describe('named sketch dimension resolution', () => {
  it('allows order-independent local references', () => {
    expect(
      errorsFor(`
sketch profile = path(
  base = line((0, 0), (20, 0)),
  side = line((20, 10)),
  constraint(side, length, base_length / 2) as side_length,
  dimension base.length at (10, -5) as base_length
);`),
    ).toEqual([]);
  });

  it('diagnoses duplicate names, visible binding collisions, and cycles', () => {
    const errors = errorsFor(`
var width = 20;
sketch profile = path(
  a = line((0, 0), (10, 0)),
  b = line((0, 5), (10, 5)),
  constraint(a, length, b_length) as a_length,
  constraint(b, length, a_length) as b_length,
  dimension a.length at (5, -4) as duplicate,
  dimension b.length at (5, 9) as duplicate,
  dimension b.length at (5, 12) as width
);`);

    expect(errors).toEqual(
      expect.arrayContaining([
        "Duplicate sketch dimension name 'duplicate'",
        "Sketch dimension name 'width' conflicts with a visible binding",
        "Cyclic sketch dimension reference involving 'a_length'",
      ]),
    );
  });

  it('validates midpoint point and segment roles', () => {
    const errors = errorsFor(`
sketch profile = path(
  base = line((0, 0), (20, 0)),
  side = line((20, 10)),
  constraint(base, midpoint, side.end)
);`);

    expect(errors).toEqual(
      expect.arrayContaining([
        'Midpoint constraint target must be a named point or segment endpoint',
        'Midpoint constraint reference must be a segment',
      ]),
    );
  });

  it('validates unary segment and binary point axis-alignment roles', () => {
    const errors = errorsFor(`
sketch profile = path(
  base = line((0, 0), (20, 0)),
  side = line((20, 10)),
  constraint(base.start, horizontal),
  constraint(base, horizontal, side.end),
  constraint(base.start, vertical, side)
);`);

    expect(errors).toEqual(
      expect.arrayContaining([
        'Horizontal constraint target must be a segment when no reference is provided',
        'Horizontal point-pair target must be a named point or segment endpoint',
        'Vertical point-pair reference must be a named point or segment endpoint',
      ]),
    );
  });

  it('accepts point-pair axis alignment, including the sketch origin', () => {
    expect(
      errorsFor(`
sketch profile = path(
  base = line((0, 0), (20, 0)),
  side = line((20, 10)),
  constraint(side.end, horizontal, base.start),
  constraint(base.start, vertical, origin)
);`),
    ).toEqual([]);
  });
});
