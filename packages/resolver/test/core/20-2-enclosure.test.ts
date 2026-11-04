/**
 * @author Aidan Boissonneault
 * @file 20-2-enclosure.test.ts
 * @purpose Tests 20 2 enclosure behavior in the core in resolver package.
 * @last-edited October 6, 2026
 */

import { describe, it } from 'vitest';
import { resolveOk } from './test-support.js';

describe('spec 20.2 — enclosure', () => {
  const SRC = `
base_unit = mm;
var wall = 2;
var w = 80;
var h = 60;
var d = 40;
env serial fallback 'SN-0001';

part enclosure {
    sketch body = rect(w, h);
    obj body = extrude(body, d);
    shell(body, wall, open: top);

    sketch lid = rect inset(wall);
    obj lid = extrude(lid, 2 , @body.top.center);

    sketch serial = word(serial, size: 5, font: 'mono', align: center);
    obj serial = cut(serial, 0.5 , @body.outer.front.center);

    fillet(@body.top.perimeter, 2);
    fillet(@body.bottom.edges, 1);
    chamfer(@lid.top.edges, 0.5);
}
`;
  it('resolves with zero errors', () => {
    resolveOk(SRC);
  });
});
