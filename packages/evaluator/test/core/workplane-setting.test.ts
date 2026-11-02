/**
 * @author Aidan Boissonneault
 * @file workplane-setting.test.ts
 * @purpose Tests workplane setting behavior in the core in evaluator package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import { evalOk } from './test-support.js';

describe('workplane setting', () => {
  it('propagates the parsed starting workplane into IR', () => {
    const { program } = evalOk(`
workplane = XZ;
part p {
    sketch s = rect(10, 5);
    obj body = extrude(s, 2);
}
`);

    expect(program.workplane).toBe('XZ');
  });
});
