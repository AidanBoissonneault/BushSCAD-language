/**
 * @author Aidan Boissonneault
 * @file range-loop.test.ts
 * @purpose Tests range loop behavior in the core in evaluator package.
 * @last-edited October 6, 2026
 */

import type { IRCut } from '@bushscad/ir';
import { describe, expect, it } from 'vitest';
import { evalErrorMessages, evalOk, opsOfKind } from './test-support.js';

describe('range loop', () => {
  it.each(['0', '-1'])('rejects a non-positive step (%s)', (step) => {
    expect(
      evalErrorMessages(
        `base_unit = mm; part p { for i in range(0, 3, ${step}) {} }`,
      ),
    ).toContain('range() step must be a finite positive number');
  });

  it('rejects a non-finite step', () => {
    expect(
      evalErrorMessages(
        'base_unit = mm; part p { for i in range(0, 3, 0 % 0) {} }',
      ),
    ).toContain('Expected a finite number, got number');
  });

  it('rejects a step that cannot advance a large starting value', () => {
    expect(
      evalErrorMessages(
        'base_unit = mm; part p { for i in range(9007199254740992, 9007199254740996, 1) {} }',
      ),
    ).toContain('range() step is too small to advance the current value');
  });

  it.each(['range(0 % 0, 3)', 'range(0, 0 % 0)'])(
    'rejects a non-finite boundary in %s',
    (range) => {
      expect(
        evalErrorMessages(`base_unit = mm; part p { for i in ${range} {} }`),
      ).toContain('Expected a finite number, got number');
    },
  );

  it('range(4) produces 4 iterations', () => {
    const { program } = evalOk(`
base_unit = mm;
part p {
    sketch base = rect(100, 80);
    obj base = extrude(base, 6);
    for i in range(4) {
        sketch hole = circle(3);
        obj hole = cut(hole, through base , @base.top.center(x: 10 + i * 12));
    }
}
`);
    const cuts = opsOfKind<IRCut>(program.ops, 'cut');
    expect(cuts).toHaveLength(4);
  });

  it('range binding increments correctly', () => {
    const { program } = evalOk(`
base_unit = mm;
part p {
    sketch base = rect(100, 80);
    obj base = extrude(base, 6);
    for i in range(3) {
        sketch h = circle(3);
        obj h = cut(h, through base , @base.top.center(x: i));
    }
}
`);
    const cuts = opsOfKind<IRCut>(program.ops, 'cut');
    const xs = cuts.map((c) => c.from.offsetX);
    expect(xs).toEqual([0, 1, 2]);
  });
});
