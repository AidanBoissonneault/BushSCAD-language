/**
 * @author Aidan Boissonneault
 * @file custom-sketch-syntax.test.ts
 * @purpose Tests custom sketch syntax behavior in the sketch in resolver package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import { parse } from '@bushscad/parser';
import { resolve } from '../../src/index.js';

/**
 * Handles no files in the sketch flow.
 */
const noFiles = () => null;

/**
 * Resolves errors against the current scope and reports unresolved references.
 */
function resolveErrors(source: string): string[] {
  const parsed = parse(source, 'custom-sketch.bscd');
  expect(parsed.errors.map((error) => error.message)).toEqual([]);
  return resolve(parsed.ast, 'custom-sketch.bscd', noFiles).errors.map(
    (error) => error.message,
  );
}

describe('custom sketch syntax resolution', () => {
  it('records named path segments for generated geometry references', () => {
    const errors = resolveErrors(`
part p {
  sketch profile = path(
    plant foot = line((0, 0), (10, 0)),
    wall = line(10, 10),
    top = close()
  );
  obj body = extrude(profile, 5);
  fillet(@body.wall.edges, 0.5);
}
`);

    expect(errors).toEqual([]);
  });

  it('rejects unknown generated face names on path sketches', () => {
    const errors = resolveErrors(`
part p {
  sketch profile = path(
    base = line((0, 0), (10, 0)),
    side = line(10, 10),
    close()
  );
  obj body = extrude(profile, 5);
  fillet(@body.missing.edges, 0.5);
}
`);

    expect(errors).toContain("Unknown named face 'missing' on object 'body'");
  });

  it('validates constrained path segment and endpoint targets', () => {
    const errors = resolveErrors(`
sketch profile = path(
  bottom = line((0, 0), (10, 0)),
  side = line((10, 8)),
  close(),
  constraint(bottom.start, fixed),
  constraint(side, perpendicular, bottom),
  constraint(side.end, coincident, missing.start)
);
`);

    expect(errors).toEqual([
      "Constraint reference 'missing.start' not found in path",
    ]);
  });

  it('validates reference dimension targets inside path sketches', () => {
    const errors = resolveErrors(`
sketch profile = path(
  bottom = line((0, 0), (10, 0)),
  dimension missing.length at (4, -4)
);
`);

    expect(errors).toEqual(["Dimension target 'missing' not found in path"]);
  });

  it('allows origin and axis dimension references inside path sketches', () => {
    const errors = resolveErrors(`
sketch profile = path(
  bottom = line((0, 0), (10, 0)),
  constraint(bottom.end, distance, origin, 10),
  dimension bottom.end.distance to origin.x_axis at (10, -4),
  dimension bottom.end.distance to origin.y_axis at (14, 0)
);
`);

    expect(errors).toEqual([]);
  });
});
