/**
 * @file place-repeatable-targets.test.ts
 * @purpose Verifies place repeats a source across selector targets.
 */

import type { IRExtrude, IRSketch } from '@bushscad/ir';
import { describe, expect, it } from 'vitest';
import { evalOk, opsOfKind } from '../core/test-support.js';

describe('repeatable place targets', () => {
  it('places a function result at the center of every matching face', () => {
    const { program } = evalOk(`
fn bracket() {
  sketch profile = rect(2, 2);
  return { obj body = extrude(profile, 2), }
}
part shell_smoke {
  obj body = extrude(rect(10, 10), 10);
  place(bracket(), @body.*.center);
}
`);

    const placedExtrudes = opsOfKind<IRExtrude>(program.ops, 'extrude').filter(
      ({ objName }) => objName !== 'body',
    );
    const sketches = opsOfKind<IRSketch>(program.ops, 'sketch');
    const placements = placedExtrudes.map(
      (extrude) =>
        sketches.find(({ name }) => name === extrude.sketchName)?.placement
          ?.faceRef,
    );

    expect(placements).toEqual([
      'body.top.center',
      'body.bottom.center',
      'body.front.center',
      'body.back.center',
      'body.left.center',
      'body.right.center',
    ]);
  });
});
