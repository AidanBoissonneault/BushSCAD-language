/**
 * @author Aidan Boissonneault
 * @file custom-sketch-placement.test.ts
 * @purpose Tests custom sketch placement behavior in the sketch in evaluator package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import type { IRSketch } from '@bushscad/ir';
import {
  evalOps,
  expectProfileSketch,
  opsOfKind,
} from '../core/test-support.js';

describe('custom sketch placement evaluation', () => {
  it('preserves path placement origin metadata', () => {
    const ops = evalOps(`
sketch plate = path(
  origin((10, 5)),
  bottom = line((0, 0), (20, 0)),
  right = line((20, 10)),
  close()
);
`);

    const sketch = expectProfileSketch(opsOfKind<IRSketch>(ops, 'sketch')[0]);
    expect(sketch.primitive.placementOrigin).toEqual([10, 5]);
  });

  it('uses placement origin as the default flat placement anchor', () => {
    const ops = evalOps(`
ref bracket {
  sketch plate = path(
    origin((10, 5)),
    bottom = line((0, 0), (20, 0)),
    right = line((20, 10)),
    top = line((0, 10)),
    left = close()
  );
  obj body = extrude(plate, 4);
}
part base_part {
  sketch base = rect(40, 20);
  obj base = extrude(base, 2);
  place(bracket, @base.top.center);
}
`);

    const placed = ops.find(
      (op): op is IRSketch =>
        op.kind === 'sketch' && Boolean(op.placement?.anchor),
    );
    expect(placed?.placement?.anchor?.localPoint).toEqual([10, 5, 0]);
    expect(placed?.placement?.anchor?.localNormal).toEqual([0, 0, -1]);
  });

  it('lets planted path sides override placement origin anchors', () => {
    const ops = evalOps(`
ref bracket {
  sketch plate = path(
    origin((10, 5)),
    plant bottom = line((0, 0), (20, 0)),
    right = line((20, 10)),
    top = line((0, 10)),
    left = close()
  );
  obj body = extrude(plate, 4);
}
part base_part {
  sketch base = rect(40, 20);
  obj base = extrude(base, 2);
  place(bracket, @base.top.center);
}
`);

    const placed = ops.find(
      (op): op is IRSketch =>
        op.kind === 'sketch' && Boolean(op.placement?.anchor),
    );
    expect(placed?.placement?.anchor?.localPoint).toEqual([10, 0, 0]);
    expect(placed?.placement?.anchor?.localNormal).toEqual([0, -1, 0]);
  });
});
