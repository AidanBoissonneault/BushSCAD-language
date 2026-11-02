/**
 * @author Aidan Boissonneault
 * @file m19-advanced-geometry.test.ts
 * @purpose Tests m19 advanced geometry behavior in the core in resolver package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import { resolveErrors, resolveOk } from './test-support.js';

describe('M19 advanced geometry', () => {
  const PROFILE = `
sketch base = path(
    a = line((0,0), (10,0)),
    lip = arc((10,0), (10,5), 5, cw),
    c = line((10,5), (0,5)),
    d = line((0,5), (0,0))
);
`;

  it('resolves path sketches, revolve, loft, named faces, and curved wrap targets', () => {
    resolveOk(`
part p {
${PROFILE}
sketch top = path(
    a = line((0,0), (8,0)),
    b = line((8,0), (8,4)),
    c = line((8,4), (0,4)),
    d = line((0,4), (0,0))
);
sketch rail = path(path = line((0,0), (0,20)));
obj vase = revolve(base, 360deg around y);
obj lofted = loft(base, top, height: 20, guide: rail);
sketch label = rect(2,1);
obj label = cut(label, 0.5 , @vase.curved(surfaceAngle: 0deg)) wrap: true;
fillet(@vase.lip.edges, 0.4);
}
`);
  });

  it('reports undefined revolve sketches and loft guides', () => {
    const errors = resolveErrors(`
obj vase = revolve(missing, 360deg around y);
${PROFILE}
obj lofted = loft(base, base, height: 20, guide: missing_rail);
`);
    expect(errors).toEqual(
      expect.arrayContaining([
        "Undefined sketch 'missing' in revolve",
        "Undefined guide sketch 'missing_rail' in loft",
      ]),
    );
  });

  it('reports invalid obj.name references', () => {
    const errors = resolveErrors(`
part p {
${PROFILE}
obj vase = revolve(base, 360deg around y);
fillet(@vase.missing.edges, 0.4);
}
`);
    expect(errors).toContain("Unknown named face 'missing' on object 'vase'");
  });

  it('reports wrap targets that are not cylindrical surface refs', () => {
    const errors = resolveErrors(`
sketch s = rect(2,2);
obj body = extrude(s, 4);
obj rib = extrude(s, 1 , @body.top) wrap: true;
`);
    expect(errors).toContain('wrap:true requires a .curved face target');
  });
});
