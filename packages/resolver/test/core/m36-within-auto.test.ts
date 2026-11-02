/**
 * @author Aidan Boissonneault
 * @file m36-within-auto.test.ts
 * @purpose Tests m36 within auto behavior in the core in resolver package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import { resolveErrors, resolveOk } from './test-support.js';

describe('M36 — within / auto', () => {
  it('accepts a within range loop using auto', () => {
    resolveOk(`
base_unit = mm;
part p {
  sketch b = rect(20, 20);
  obj b = extrude(b, 4);
  for i in range(3) within b.top.width {
    sketch h = circle(2);
    obj h = cut(h, through b , @b.top(x: auto, y: 5));
  }
}
`);
  });

  it('rejects a within dimension count that mismatches the iterator', () => {
    const errors = resolveErrors(`
base_unit = mm;
part p {
  sketch b = rect(20, 20);
  obj b = extrude(b, 4);
  for i in range(3) within(b.top.width, b.top.height) {
    sketch h = circle(2);
    obj h = cut(h, through b , @b.top(x: auto, y: 5));
  }
}
`);
    expect(errors.some((e) => e.includes("'within' expects 1 dimension"))).toBe(
      true,
    );
  });

  it('rejects auto used outside a within loop or parent-face context', () => {
    const errors = resolveErrors(`
base_unit = mm;
var x = auto;
`);
    expect(
      errors.some((e) => e.includes("'auto' requires a 'within' loop")),
    ).toBe(true);
  });
});
