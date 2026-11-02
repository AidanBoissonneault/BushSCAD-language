/**
 * @author Aidan Boissonneault
 * @file 20-3-parametric-panel-with-env-grid.test.ts
 * @purpose Tests 20 3 parametric panel with env grid behavior in the core in resolver package.
 * @last-edited October 6, 2026
 */

import { describe, it } from 'vitest';
import { resolveOk } from './test-support.js';

describe('spec 20.3 — parametric panel with env grid', () => {
  const SRC = `
base_unit = mm;
env grid_cols  fallback 4;
env grid_rows  fallback 3;
env spacing    fallback 22;
env hole_dia   fallback 3;
env build_mode fallback 'debug';

part panel {
    sketch base = rect(100, 80);
    obj base = extrude(base, 6);
    for (i, j) in grid(cols: grid_cols, rows: grid_rows, spacing: spacing) {
        sketch hole = circle(hole_dia);
        obj hole = cut(hole, through base , @base.top.front_left(x: 10 + i, y: 10 + j));
    }
    if build_mode == 'release' {
        fillet(@base.top.edges, 2);
        fillet(@base.bottom.edges, 1);
    }
}
`;
  it('resolves with zero errors', () => {
    resolveOk(SRC);
  });
});
