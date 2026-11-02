/**
 * @author Aidan Boissonneault
 * @file wrap-placement.test.ts
 * @purpose Tests wrap placement behavior in the geometry in resolver package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import { resolveErrors } from '../core/test-support.js';

describe('curved wrap placement syntax', () => {
  it('resolves wrap on curved face placements', () => {
    expect(
      resolveErrors(`
part p {
    sketch profile = circle(5);
    obj cyl = extrude(profile, 10);
    obj label = cut(profile, 0.5, @cyl.curved(0deg, wrap));
}
`),
    ).toHaveLength(0);
  });

  it('reports wrap on non-curved face placements', () => {
    expect(
      resolveErrors(`
part p {
    sketch profile = circle(5);
    obj body = extrude(profile, 10);
    obj rib = extrude(profile, 1, @body.top(wrap));
}
`),
    ).toContain('wrap:true requires a .curved face target');
  });
});
