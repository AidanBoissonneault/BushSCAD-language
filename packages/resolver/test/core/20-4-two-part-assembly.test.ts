/**
 * @author Aidan Boissonneault
 * @file 20-4-two-part-assembly.test.ts
 * @purpose Tests 20 4 two part assembly behavior in the core in resolver package.
 * @last-edited October 6, 2026
 */

import { describe, it } from 'vitest';
import { resolveOk } from './test-support.js';

describe('spec 20.4 — two-part assembly', () => {
  const SRC = `
base_unit = mm;

part base_plate {
    sketch base = rect(100, 80);
    obj base = extrude(base, 6);
    for pt in [
        @base.top.front_left(x:  8, y:  8),
        @base.top.front_right(x: -8, y:  8),
        @base.top.back_left(x:  8, y: -8),
        @base.top.back_right(x: -8, y: -8)
    ] {
        sketch hole = circle(3);
        obj hole = cut(hole, through base , @pt);
    }
    fillet(@base.top.edges, 1);
    part.color = #2563EB;
}

part lid {
    sketch face = rect(100, 80);
    obj face = extrude(face, 3 , @base_plate.top.center);
    chamfer(@face.top.edges, 0.3);
    part.color = #7C3AED;
}
`;
  it('resolves with zero errors', () => {
    resolveOk(SRC);
  });
});
