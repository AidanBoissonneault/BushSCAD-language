/**
 * @author Aidan Boissonneault
 * @file command-call-syntax.test.ts
 * @purpose Tests command call syntax behavior in the statements in evaluator package.
 * @last-edited October 6, 2026
 */

import type {
  IRFit,
  IRMirror,
  IRPatternLinear,
  IRThread,
  IRTransform,
} from '@bushscad/ir';
import { describe, expect, it } from 'vitest';
import { evalOk, opsOfKind } from '../core/test-support.js';

describe('command call syntax evaluation', () => {
  it('lowers new command call forms through existing IR operations', () => {
    const { program } = evalOk(`
base_unit = mm;
part p {
  sketch base = rect(20, 20);
  obj base = extrude(base, 10);
  sketch hole = circle(2);
  obj hole = extrude(hole, 1, @base.top(0, 0));
  pattern(hole, linear, 4, 12);
  mirror(base, X);
  transform(base, translate(10, y: 5));
  fit(clearance, M3_bolt, through, hole);
  thread(hole, internal, 4, 0.7, length: 8);
}
`);

    expect(
      opsOfKind<IRPatternLinear>(program.ops, 'patternLinear')[0],
    ).toMatchObject({
      objName: 'hole',
      countX: 4,
      countY: 1,
      spacingX: 12,
    });
    expect(opsOfKind<IRMirror>(program.ops, 'mirror')[0]).toMatchObject({
      objName: 'base',
      across: { kind: 'world', axis: 'x' },
    });
    expect(opsOfKind<IRTransform>(program.ops, 'transform')[0]).toMatchObject({
      objName: 'base',
      operation: { kind: 'translate', x: 10, y: 5, z: 0 },
    });
    expect(opsOfKind<IRFit>(program.ops, 'fit')[0]).toMatchObject({
      fitName: 'M3_bolt',
      toleranceLevel: 'normal',
    });
    expect(opsOfKind<IRThread>(program.ops, 'thread')[0]).toMatchObject({
      target: 'hole',
      threadType: 'internal',
      axialExtentMm: 8,
      direction: 'regular',
    });
  });
});
