/**
 * @file eval-work-origin-placement.test.ts
 * @purpose Tests work-origin placement lowering in the evaluator package.
 */

import type { IRExtrude } from '@bushscad/ir';
import { describe, expect, it } from 'vitest';
import { evalOk, opsOfKind } from '../core/test-support.js';

describe('work-origin placement', () => {
  it('records the active workplane and Cartesian offsets on the target', () => {
    const { program } = evalOk(`
workplane = XZ;
part assembly {
  sketch profile = rect(8, 4);
  obj body = extrude(profile, 2, @origin.front(x: 5, y: -2));
}
`);
    const [placement] = opsOfKind<IRExtrude>(program.ops, 'extrude');

    expect(placement?.from).toMatchObject({
      faceRef: 'origin.front',
      workplane: 'XZ',
      offsetX: 5,
      offsetY: -2,
    });
  });

  it('lowers polar offsets in the active workplane', () => {
    const { program } = evalOk(`
workplane = YZ;
part assembly {
  sketch profile = rect(8, 4);
  obj body = extrude(profile, 2, @origin.top(20, 90deg));
}
`);
    const [placement] = opsOfKind<IRExtrude>(program.ops, 'extrude');

    expect(placement?.from).toMatchObject({
      faceRef: 'origin.top',
      workplane: 'YZ',
      radius: 20,
      angleDeg: 90,
    });
  });
});
