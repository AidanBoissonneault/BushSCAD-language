/**
 * @author Aidan Boissonneault
 * @file thread.test.ts
 * @purpose Tests thread behavior in the core in evaluator package.
 * @last-edited October 6, 2026
 */

import type { IRThread } from '@bushscad/ir';
import { describe, expect, it } from 'vitest';
import { evalOk, opsOfKind } from './test-support.js';

describe('thread evaluation', () => {
  it('emits explicit thread angle degrees', () => {
    const { program } = evalOk(`
base_unit = mm;
part bolt {
    sketch shaft = circle(6);
    obj shaft = extrude(shaft, 20);
    thread(shaft, external, 6, 1, length: 12, direction: clockwise, angle: 18deg);
}
`);
    const thread = opsOfKind<IRThread>(program.ops, 'thread')[0];
    expect(thread).toMatchObject({
      target: 'shaft',
      threadType: 'external',
      direction: 'clockwise',
      threadAngleDeg: 18,
    });
  });

  it('leaves omitted thread angle null', () => {
    const { program } = evalOk(`
base_unit = mm;
part bolt {
    sketch shaft = circle(6);
    obj shaft = extrude(shaft, 20);
    thread(shaft, external, 6, 1, length: 12, direction: regular);
}
`);
    const thread = opsOfKind<IRThread>(program.ops, 'thread')[0];
    expect(thread.threadAngleDeg).toBeNull();
  });
});
