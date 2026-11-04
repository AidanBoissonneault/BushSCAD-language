/**
 * @author Aidan Boissonneault
 * @file body-operation-scope.test.ts
 * @purpose Verifies body operations execute at root and nested statement scopes.
 * @last-edited November 4, 2026
 */

import { describe, expect, it } from 'vitest';
import type { IRShell } from '@bushscad/ir';
import { evalOps, opsOfKind } from '../core/test-support.js';

describe('body operation statement scopes', () => {
  it('evaluates shell calls at file scope and inside nested control flow', () => {
    const ops = evalOps(`
obj top_body = cube([20, 20, 10]);
shell(top_body, 2);
part nested {
  obj local_body = cube([20, 20, 10]);
  for index in range(1) {
    if index == 0 { shell(local_body, 1, top); }
  }
}
`);

    expect(opsOfKind<IRShell>(ops, 'shell').map((op) => op.objName)).toEqual([
      'top_body',
      'local_body',
    ]);
  });
});
