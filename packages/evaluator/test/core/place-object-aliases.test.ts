/**
 * @file place-object-aliases.test.ts
 * @purpose Checks selectors for a body and a placed function result stay distinct.
 */

import type { IRFillet } from '@bushscad/ir';
import { describe, expect, it } from 'vitest';
import { evalOk, opsOfKind } from './test-support.js';

describe('placed function object aliases', () => {
  it('keeps body selectors scoped and resolves a place alias to its own result', () => {
    const { program } = evalOk(`
fn bracket() {
  sketch profile = rect(2, 2);
  return { obj body = extrude(profile, 2), }
}
part shell_smoke {
  sketch body = rect(10, 10);
  obj body = extrude(body, 10);
  place(bracket(), @body.top.center) as bracket_extension;
  fillet(@body.top, 0.125);
  fillet(@body.top.edges, 0.25);
  fillet(@bracket_extension.top.edges, 0.25);
}
`);

    const fillets = opsOfKind<IRFillet>(program.ops, 'fillet');

    expect(fillets).toHaveLength(3);
    expect(fillets.map(({ target }) => target)).toEqual([
      'body.top',
      'body.top.edges',
      expect.stringMatching(/^body_\d+\.top\.edges$/),
    ]);
    expect(fillets[2]?.target).not.toMatch(/^body\.top(?:\.edges)?$/);
  });
});
