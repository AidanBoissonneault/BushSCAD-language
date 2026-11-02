/**
 * @author Aidan Boissonneault
 * @file path-body-expressions.test.ts
 * @purpose Tests path body expressions behavior in the sketch in resolver package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import { resolveErrors, resolveOk } from '../core/test-support.js';

const CLOSED_PROFILE = `
sketch profile = path(
  outer_bottom = line((0, 0), (20, 0)),
  outer_right = line((20, 20)),
  outer_top = line((0, 20)),
  outer_left = close(),
  inner_bottom = line((5, 5), (15, 5)),
  inner_right = line((15, 15)),
  inner_top = line((5, 15)),
  inner_left = close(),
  outer = loop(outer_bottom),
  hole = loop(inner_bottom),
  ring = outer - hole
);
`;

describe('path body expression resolution', () => {
  it('resolves direct feature algebra, prior aliases, and ignored expressions', () => {
    resolveOk(`
sketch profile = path(
  outer_bottom = line((0, 0), (20, 0)),
  outer_right = line((20, 20)),
  outer_top = line((0, 20)),
  outer_left = close(),
  inner_bottom = line((5, 5), (15, 5)),
  inner_right = line((15, 15)),
  inner_top = line((5, 15)),
  inner_left = close(),
  direct_subtract = outer_bottom - inner_bottom,
  direct_union = outer_bottom + inner_bottom,
  direct_intersection = outer_bottom & inner_bottom,
  ring = direct_union - direct_intersection,
  sweep = ring,
  ignore(direct_subtract + direct_intersection)
);
obj selected = extrude(profile.sweep, 2);
`);
  });

  it('allows selectors in ordinary extrude, cut, and inline cut extrude tools', () => {
    resolveOk(`
${CLOSED_PROFILE}
obj base = extrude(profile.ring, 4);
obj pocket = cut([profile.ring, profile.hole], 1, @base.top.center);
obj channel = cut(extrude(profile.ring, 1), @base.top.center);
    `);
  });

  it('allows selectors on locally placed path sketches', () => {
    resolveOk(`
sketch profile = path(
  bottom = line((0, 0), (20, 0)),
  right = line((20, 20)),
  top = line((0, 20)),
  left = close(),
  face = loop(bottom)
) at (7, -3);
obj selected = extrude(profile.face, 2);
`);
  });

  it('reports unknown features and forward body aliases', () => {
    const messages = resolveErrors(`
sketch profile = path(
  edge = line((0, 0), (10, 0)),
  missing_loop = loop(missing_feature),
  before = later,
  later = loop(edge)
);
`);

    expect(messages).toContain(
      "Unknown path body or feature 'missing_feature'",
    );
    expect(messages).toContain("Unknown path body or feature 'later'");
  });

  it('reports duplicate aliases across point and expression declarations', () => {
    expect(
      resolveErrors(`
sketch profile = path(
  edge = line((0, 0), (10, 0)),
  duplicate = closed(1, 1),
  duplicate = loop(edge)
);
`),
    ).toContain("Duplicate closed body 'duplicate'");
  });

  it('rejects later aliases referenced by ignore expressions', () => {
    expect(
      resolveErrors(`
sketch profile = path(
  edge = line((0, 0), (10, 0)),
  ignore(later),
  later = loop(edge)
);
`),
    ).toEqual(["Unknown path body or feature 'later'"]);
  });

  it.each([
    ['revolve', 'obj result = revolve(profile.ring, 360deg around y);'],
    ['loft', 'obj result = loft(profile.ring, profile.hole, height: 5);'],
    [
      'loft guide',
      'obj result = loft(profile, profile, height: 5, guide: profile.ring);',
    ],
    ['sweep', 'obj result = sweep(profile.ring along rail);'],
    [
      'sweep cut',
      'obj result = cut(sweep(profile.ring along rail), through base, @base.top.center);',
    ],
    [
      'radial_extrude',
      'obj result = radial_extrude(profile.ring, axis: z, angle: 90, length: 5);',
    ],
    [
      'radial_cut',
      'obj result = radial_cut(profile.ring, axis: z, angle: 90, length: 5);',
    ],
  ])('rejects selectors in %s', (context, operation) => {
    const messages = resolveErrors(`
${CLOSED_PROFILE}
path rail = polyline([(0, 0, 0), (0, 0, 10)]);
obj base = extrude(profile, 4);
${operation}
`);

    expect(messages).toContain(
      `Sketch body selection is not supported in ${context}`,
    );
  });

  it.each([
    [
      'extrude',
      'obj result = extrude(profile.ring, 1, @base.curved(0deg, wrap));',
    ],
    ['cut', 'obj result = cut(profile.ring, 1, @base.curved(0deg, wrap));'],
  ])('rejects selectors in wrapped %s', (context, operation) => {
    const messages = resolveErrors(`
${CLOSED_PROFILE}
obj base = extrude(profile, 4);
${operation}
`);

    expect(messages).toContain(
      `Sketch body selection is not supported in ${context}`,
    );
  });
});
