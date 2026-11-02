/**
 * @author Aidan Boissonneault
 * @file mixed-path-primitives.test.ts
 * @purpose Tests mixed path primitives behavior in the sketch in resolver package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import { resolveErrors, resolveOk } from '../core/test-support.js';

describe('mixed path primitive resolution', () => {
  it('resolves primitive expressions and exposes generated segment names', () => {
    resolveOk(`
var width = 80;
var diameter = 12;
sketch plate = path(
  rect(width, 40, top: mounting_top) at (width / 2, 20),
  circle(diameter) at (20, 20),
  construction center = line((0, 20), (width, 20)),
  constraint(mounting_top, horizontal),
  dimension circle_2_q1.radius at (30, 20)
);
obj body = extrude(plate, 4);
fillet(@body.mounting_top.edges, 1);
`);
  });

  it('reports unknown generated names without rejecting canonical names', () => {
    expect(
      resolveErrors(`
sketch plate = path(
  rect(80, 40),
  constraint(rect_2_top, horizontal)
);
`),
    ).toContain("Constraint target 'rect_2_top' not found in path");
  });
});
