/**
 * @author Aidan Boissonneault
 * @file function-return-blocks.test.ts
 * @purpose Tests function return blocks behavior in the core in resolver package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import { resolveErrors, resolveOk } from './test-support.js';

describe('function return blocks', () => {
  it('allows setup statements followed by a final return block', () => {
    resolveOk(`
fn cs_hole(pilot_d, cs_d, depth) {
    sketch pilot = circle(pilot_d);
    sketch cs = circle(cs_d);
    return {
        obj pilot = cut(pilot, depth),
        obj cs = cut(cs, depth * 0.4),
    }
}
part p {
    sketch base = rect(30, 30);
    obj base = extrude(base, 4);
    place(cs_hole(3, 6, 3), @base.top.center);
}
`);
  });

  it('rejects return outside functions', () => {
    const errors = resolveErrors(`
part p {
    return {
        sketch h = circle(3),
    }
}
`);
    expect(errors.some((e) => e.includes("'return' is only valid"))).toBe(true);
  });

  it('rejects multiple function return blocks', () => {
    const errors = resolveErrors(`
fn bad() {
    return {}
    return {}
}
`);
    expect(errors.some((e) => e.includes('at most one return'))).toBe(true);
  });

  it('rejects statements after a function return block', () => {
    const errors = resolveErrors(`
fn bad() {
    return {}
    sketch h = circle(3);
}
`);
    expect(errors.some((e) => e.includes('final statement'))).toBe(true);
  });
});
