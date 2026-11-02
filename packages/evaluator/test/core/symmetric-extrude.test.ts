/**
 * @author Aidan Boissonneault
 * @file symmetric-extrude.test.ts
 * @purpose Tests symmetric extrude behavior in the core in evaluator package.
 * @last-edited October 6, 2026
 */

import type { IRExtrude } from '@bushscad/ir';
import { describe, expect, it } from 'vitest';
import { evalOk, opsOfKind } from './test-support.js';

describe('symmetric extrude', () => {
  it('symmetric flag propagated', () => {
    const { program } = evalOk(`
base_unit = mm;
part p {
    sketch s = rect(10, 10);
    obj s = extrude(s, 5 symmetric);
}
`);
    const ext = opsOfKind<IRExtrude>(program.ops, 'extrude')[0];
    expect(ext.symmetric).toBe(true);
  });
});
