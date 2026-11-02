/**
 * @author Aidan Boissonneault
 * @file where-filter.test.ts
 * @purpose Tests where filter behavior in the core in evaluator package.
 * @last-edited October 6, 2026
 */

import type { IRCut } from '@bushscad/ir';
import { describe, expect, it } from 'vitest';
import { evalOk, opsOfKind } from './test-support.js';

describe('where filter', () => {
  it('filters iterations matching predicate', () => {
    const { program } = evalOk(`
base_unit = mm;
var sizes = [0, 3, 0, 4, 5];
part p {
    sketch base = rect(100, 80);
    obj base = extrude(base, 6);
    for d in sizes where d > 0 {
        sketch h = circle(d);
        obj h = cut(h, through base , @base.top.center);
    }
}
`);
    const cuts = opsOfKind<IRCut>(program.ops, 'cut');
    expect(cuts).toHaveLength(3); // only d=3,4,5 pass
  });
});
