/**
 * @author Aidan Boissonneault
 * @file unit-expressions.test.ts
 * @purpose Tests unit expressions behavior in the core in evaluator package.
 * @last-edited October 6, 2026
 */

import type { IRSketch } from '@bushscad/ir';
import { describe, expect, it } from 'vitest';
import { evalOk } from './test-support.js';

describe('unit expressions', () => {
  it('2in converts to 50.8 in mm base', () => {
    const { program } = evalOk(`
base_unit = mm;
part p {
    sketch s = circle(2in);
    obj s = extrude(s, 1);
}
`);
    const sk = program.ops[0] as IRSketch;
    expect((sk.primitive as { diameter: number }).diameter).toBeCloseTo(50.8);
  });

  it('1cm = 10 in mm base', () => {
    const { program } = evalOk(`
base_unit = mm;
part p {
    sketch s = rect(1cm, 2cm);
    obj s = extrude(s, 1);
}
`);
    const sk = program.ops[0] as IRSketch;
    expect((sk.primitive as { width: number }).width).toBe(10);
    expect((sk.primitive as { height: number }).height).toBe(20);
  });
});
