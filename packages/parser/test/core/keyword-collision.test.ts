/**
 * @author Aidan Boissonneault
 * @file keyword-collision.test.ts
 * @purpose Tests keyword collision behavior in the core in parser package.
 * @last-edited October 6, 2026
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse } from '../../src/core/parser.js';

/**
 * Parses ok from the supplied source into the core representation.
 */
function parseOk(src: string): ReturnType<typeof parse>['ast'] {
  const result = parse(src, 'keyword-collision.bscd');
  expect(result.errors).toEqual([]);
  return result.ast;
}

describe('parser keyword collisions', () => {
  it('parses radial sweep named argument after sweep became a keyword', () => {
    parseOk(`
part housing {
  obj body = extrude(body, 10);
  for a in radial(4, start: 45deg, sweep: 360deg) {
    sketch mh = circle(3.5);
    obj mh = cut(mh, through body , @body.top.center(radius: 30, angle: a));
  }
}
`);
  });

  it('parses the full integration fixture that uses radial sweep', () => {
    const fixtureUrl = new URL(
      '../../../../examples/test-10-full-integration.bscd',
      import.meta.url,
    );
    const source = readFileSync(fixtureUrl, 'utf8');
    const result = parse(source, 'test-10-full-integration.bscd');
    expect(result.errors).toEqual([]);
  });

  it('parses sweep operations when the path is named path', () => {
    parseOk(`
path path = polyline([(0, 0, 0), (0, 0, 10)]);
sketch profile = circle(2);
obj x = sweep(profile along path);
`);
  });

  it('parses path segment names that collide with keywords', () => {
    parseOk(`
sketch profile = path(
  path = line((0, 0), (10, 0)),
  sweep = line((10, 0), (10, 10)),
  close = line((10, 10), (0, 0))
);
`);
  });
});
