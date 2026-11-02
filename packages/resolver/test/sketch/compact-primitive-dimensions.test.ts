/**
 * @author Aidan Boissonneault
 * @file compact-primitive-dimensions.test.ts
 * @purpose Tests compact primitive dimensions behavior in the sketch in resolver package.
 * @last-edited October 6, 2026
 */

import { parse } from '@bushscad/parser';
import { describe, expect, it } from 'vitest';
import { resolve } from '../../src/index.js';

/**
 * Handles resolved in the sketch flow.
 */
function resolved(source: string) {
  const parsed = parse(source, 'compact-dimensions.bscd');
  expect(parsed.errors.map((error) => error.message)).toEqual([]);
  return resolve(parsed.ast, 'compact-dimensions.bscd', () => null);
}

describe('compact primitive dimension resolution', () => {
  it('binds rectangle and circle placeholders from owned assignments', () => {
    const result = resolved(`
var plate_width = 77.808;
sketch plate = rect(_, 44.384, left: datum) at (42.796, 22.192);
@plate.bottom = plate_width;
@(plate.datum, origin.y_axis) = 3;
sketch hole = circle(_);
@hole.diameter = 12;
`);

    expect(result.errors).toEqual([]);
    const [plate, hole] = result.ast.statements.filter(
      (item) => item.kind === 'sketch',
    );
    expect(plate).toMatchObject({
      primitive: {
        primitive: {
          width: { kind: 'identifier', name: 'plate_width' },
          compactDimensions: [{ parameter: 'width' }, {}],
        },
      },
    });
    expect(hole).toMatchObject({
      primitive: {
        diameter: { kind: 'number', value: 12 },
        compactDimensions: [{ parameter: 'diameter' }],
      },
    });
  });

  it('rejects an unbound placeholder and unknown side reference', () => {
    const parsed = parse(
      `
sketch plate = rect(_, 20);
@plate.missing = 10;
`,
      'compact-dimensions.bscd',
    );
    expect(parsed.errors.map((error) => error.message)).toContain(
      "No compact primitive owns dimension reference 'missing'",
    );
    const result = resolve(
      parsed.ast,
      'compact-dimensions.bscd',
      () => null,
    );
    expect(result.errors.map((error) => error.message)).toContain(
      "Compact primitive '_' for 'width' requires a following @ dimension assignment",
    );
  });
});
