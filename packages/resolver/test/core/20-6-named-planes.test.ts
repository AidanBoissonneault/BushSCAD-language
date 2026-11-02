/**
 * @author Aidan Boissonneault
 * @file 20-6-named-planes.test.ts
 * @purpose Tests 20 6 named planes behavior in the core in resolver package.
 * @last-edited October 6, 2026
 */

import { describe, it } from 'vitest';
import { resolveOk } from './test-support.js';

describe('spec 20.6 — named planes', () => {
  const SRC = `
base_unit = mm;

part tiered {
    sketch base = rect(80, 60);
    obj base = extrude(base, 5);

    plane lvl1 = offset(5 , @base.top);
    plane lvl2 = offset(10 , @lvl1);

    sketch mid = rect(60, 40);
    obj mid = extrude(mid, 5 , @lvl1);

    sketch top = rect(40, 20);
    obj top = extrude(top, 5 , @lvl2);

    sketch l1 = word('L1', size: 5, font: 'sans', align: center);
    obj l1 = cut(l1, 0.5 , @base.top.center);

    sketch l2 = word('L2', size: 5, font: 'sans', align: center);
    obj l2 = cut(l2, 0.5 , @mid.top.center);

    fillet(@base.top.edges, 1);
    fillet(@mid.top.edges, 1);
    fillet(@top.top.edges, 1);
}
`;
  it('resolves with zero errors', () => {
    resolveOk(SRC);
  });
});
