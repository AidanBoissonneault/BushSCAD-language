/**
 * @author Aidan Boissonneault
 * @file list-loop-point-tuples.test.ts
 * @purpose Tests list loop point tuples behavior in the core in evaluator package.
 * @last-edited October 6, 2026
 */

import type { IRCut } from '@bushscad/ir';
import { describe, expect, it } from 'vitest';
import { evalErrorMessages, evalOk, opsOfKind } from './test-support.js';

describe('list loop point tuples', () => {
  it('rejects pair bindings when a list item is not a two-value tuple', () => {
    for (const values of ['[[1, 2], [3]]', '[1, 2]']) {
      expect(
        evalErrorMessages(
          `base_unit = mm; part p { for (x, y) in ${values} {} }`,
        ),
      ).toContain(
        'A two-name list loop requires each item to contain exactly two values',
      );
    }
  });

  it('destructures two-value list items', () => {
    const { program } = evalOk(`
base_unit = mm;
part p {
    sketch base = rect(30, 30);
    obj base = extrude(base, 4);
    for (x, y) in [(8, 8), (12, 14)] {
        sketch h = circle(3);
        obj h = cut(h, through base, @base.top(x: x, y: y));
    }
}
`);
    const cuts = opsOfKind<IRCut>(program.ops, 'cut');
    expect(cuts.map((cut) => [cut.from.offsetX, cut.from.offsetY])).toEqual([
      [8, 8],
      [12, 14],
    ]);
  });

  it('resolves pt.x and pt.y , @tuple loop items', () => {
    const { program } = evalOk(`
base_unit = mm;
var pts = [(8, 8), (12, 14)];
part p {
    sketch base = rect(30, 30);
    obj base = extrude(base, 4);
    for pt in pts {
        sketch h = circle(3);
        obj h = cut(h, through base , @base.top(x: pt.x, y: pt.y));
    }
}
`);
    const cuts = opsOfKind<IRCut>(program.ops, 'cut');
    expect(cuts.map((c) => ({ x: c.from.offsetX, y: c.from.offsetY }))).toEqual(
      [
        { x: 8, y: 8 },
        { x: 12, y: 14 },
      ],
    );
  });
});
