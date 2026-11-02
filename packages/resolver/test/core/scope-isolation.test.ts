/**
 * @author Aidan Boissonneault
 * @file scope-isolation.test.ts
 * @purpose Tests scope isolation behavior in the core in resolver package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import { resolveErrors, resolveOk } from './test-support.js';

describe('scope isolation', () => {
  it('for-body binding not visible outside loop', () => {
    const errors = resolveErrors(`
part p {
    sketch b = rect(1, 1);
    obj b = extrude(b, 5);
    for i in range(4) {
        sketch h = circle(i);
        obj h = cut(h, through b , @b.top.center);
    }
    fillet(@b.top.edges, i);
}
`);
    expect(errors.some((e) => e.includes("'i'"))).toBe(true);
  });

  it('fn param not visible outside fn', () => {
    const errors = resolveErrors(`
fn make(d) {
    sketch h = circle(d);
    obj h = cut(h, through base , @base.top.center);
}
var x = d;
`);
    expect(errors.some((e) => e.includes("'d'"))).toBe(true);
  });

  it('forward reference to top-level component allowed', () => {
    resolveOk(`
part lid {
    sketch face = rect(100, 80);
    obj face = extrude(face, 3 , @base_plate.top.center);
}
part base_plate {
    sketch base = rect(100, 80);
    obj base = extrude(base, 6);
}
`);
  });
});
