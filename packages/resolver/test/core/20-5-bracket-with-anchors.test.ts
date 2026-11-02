/**
 * @author Aidan Boissonneault
 * @file 20-5-bracket-with-anchors.test.ts
 * @purpose Tests 20 5 bracket with anchors behavior in the core in resolver package.
 * @last-edited October 6, 2026
 */

import { describe, it } from 'vitest';
import { resolveOk } from './test-support.js';

describe('spec 20.5 — bracket with anchors', () => {
  const SRC = `
base_unit = mm;

export ref bracket {
    sketch body = rect(this.width - 4, 20);
    obj body = extrude(body, 5);
    sketch gusset = triangle(8, 8);
    obj gusset = extrude(gusset, 5 , @body.back.center);
    @mount = @body.bottom.front_left;
    @center = @body.bottom.center;
    fillet(@body.top.edges, 1);
    fillet(@gusset.edges, 0.5);
    chamfer(@body.bottom.edges, 0.3);
}

part frame {
    sketch base = rect(120, 80);
    obj base = extrude(base, 10);
    for pt in [
        @base.top.front_left(x:  6, y:  6),
        @base.top.front_right(x: -6, y:  6),
        @base.top.back_left(x:  6, y: -6),
        @base.top.back_right(x: -6, y: -6)
    ] {
        place(bracket, @pt, @mount);
    }
    fillet(@base.front.edges, 2);
    fillet(@base.back.edges, 2);
}
`;
  it('resolves with zero errors', () => {
    resolveOk(SRC);
  });
});
