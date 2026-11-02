/**
 * @author Aidan Boissonneault
 * @file 20-1-mounting-plate.test.ts
 * @purpose Tests 20 1 mounting plate behavior in the core in resolver package.
 * @last-edited October 6, 2026
 */

import { describe, it } from 'vitest';
import { resolveOk } from './test-support.js';

describe('spec 20.1 — mounting plate', () => {
  const SRC = `
base_unit = mm;
var plate_w = 60;
var plate_h = 40;
var plate_d = 10;
var hole_d  = 3;

part plate {
    sketch base = rect(plate_w, plate_h);
    obj base = extrude(base, plate_d);
    for (i, j) in grid(cols: 2, rows: 2, spacing_x: 44, spacing_y: 28) {
        sketch hole = circle(hole_d);
        obj hole = cut(hole, through base , @base.top.front_left(x: 8 + i, y: 6 + j));
    }
    fillet(@base.top.edges, 1.5);
    chamfer(@base.bottom.edges, 0.5);
}
`;
  it('resolves with zero errors', () => {
    resolveOk(SRC);
  });
});
