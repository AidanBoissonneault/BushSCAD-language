/**
 * @author Aidan Boissonneault
 * @file if-else-pruning.test.ts
 * @purpose Tests if else pruning behavior in the core in evaluator package.
 * @last-edited October 6, 2026
 */

import type { IRChamfer, IRFillet } from '@bushscad/ir';
import { describe, expect, it } from 'vitest';
import { evalOk, opsOfKind } from './test-support.js';

describe('if/else pruning', () => {
  it('true branch executes, false branch skipped', () => {
    const { program } = evalOk(`
base_unit = mm;
var debug = true;
part p {
    sketch base = rect(60, 40);
    obj base = extrude(base, 10);
    if debug {
        fillet(@base.top.edges, 2);
    } else {
        chamfer(@base.top.edges, 1);
    }
}
`);
    const fillets = opsOfKind<IRFillet>(program.ops, 'fillet');
    const chamfers = opsOfKind<IRChamfer>(program.ops, 'chamfer');
    expect(fillets).toHaveLength(1);
    expect(chamfers).toHaveLength(0);
  });

  it('false branch executes else', () => {
    const { program } = evalOk(`
base_unit = mm;
var debug = false;
part p {
    sketch base = rect(60, 40);
    obj base = extrude(base, 10);
    if debug {
        fillet(@base.top.edges, 2);
    } else {
        chamfer(@base.top.edges, 1);
    }
}
`);
    const fillets = opsOfKind<IRFillet>(program.ops, 'fillet');
    const chamfers = opsOfKind<IRChamfer>(program.ops, 'chamfer');
    expect(fillets).toHaveLength(0);
    expect(chamfers).toHaveLength(1);
  });
});
