/**
 * @author Aidan Boissonneault
 * @file place-origin.test.ts
 * @purpose Tests place origin behavior in the geometry in evaluator package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import type { IRAlignShape, IROp, IRSketch } from '@bushscad/ir';
import { evalOps } from '../core/test-support.js';

/**
 * Handles placed sketch in the geometry flow.
 */
function placedSketch(ops: IROp[]): IRSketch {
  const emitted = ops.filter((op): op is IRSketch => op.kind === 'sketch');
  const placed = emitted.at(-1);
  if (!placed) throw new Error('Expected at least one sketch');
  return placed;
}

/**
 * Handles align shapes in the geometry flow.
 */
function alignShapes(ops: IROp[]): IRAlignShape[] {
  return ops.filter((op): op is IRAlignShape => op.kind === 'alignShape');
}

describe('place origin overload evaluation', () => {
  it('places a component at the world origin when target is omitted', () => {
    const ops = evalOps(`
part child {
  sketch s = rect(4, 2);
  obj body = extrude(s, 3);
}

part root {
  place(child);
}
`);

    expect(placedSketch(ops).placement).toMatchObject({ faceRef: '0,0,0' });
  });

  it('places a local ref object at the world origin when target is omitted', () => {
    const ops = evalOps(`
part root {
  sketch s = rect(4, 2);
  ref body = extrude(s, 3);
  place(body);
}
`);

    expect(ops).toContainEqual(
      expect.objectContaining({
        kind: 'alignShape',
        name: 'body',
        sourceRef: 'body.bottom.center',
        targetPlacement: { faceRef: '0,0,0' },
      }),
    );
  });

  it('uses a planted path line as the default ref source anchor', () => {
    const ops = evalOps(`
part root {
  sketch profile = path(
    plant bottom = line((0, 0), (28, 0)),
    right = line(28, 12),
    top = line(0, 12),
    left = close()
  );
  ref body = extrude(profile, 8);
  place(body);
}
`);

    expect(alignShapes(ops)[0]).toMatchObject({
      name: 'body',
      sourceRef: 'body.front.center',
      targetPlacement: { faceRef: '0,0,0' },
    });
  });

  it('maps a planted right path line to the generated right side face', () => {
    const ops = evalOps(`
part root {
  sketch profile = path(
    bottom = line((0, 0), (28, 0)),
    plant right = line(28, 12),
    top = line(0, 12),
    left = close()
  );
  ref body = extrude(profile, 8);
  place(body);
}
`);

    expect(alignShapes(ops)[0]).toMatchObject({
      name: 'body',
      sourceRef: 'body.right.center',
      targetPlacement: { faceRef: '0,0,0' },
    });
  });

  it('lets an explicit source anchor override the planted ref default', () => {
    const ops = evalOps(`
part root {
  sketch profile = path(
    plant bottom = line((0, 0), (28, 0)),
    right = line(28, 12),
    top = line(0, 12),
    left = close()
  );
  ref body = extrude(profile, 8);
  place(body, @body.top.center, @body.top.center);
}
`);

    expect(alignShapes(ops)[0]).toMatchObject({
      sourceRef: 'body.top.center',
      targetPlacement: { faceRef: 'body.top.center' },
    });
  });

  it('keeps place-time rotation on origin placement', () => {
    const ops = evalOps(`
part child {
  sketch s = rect(4, 2);
  obj body = extrude(s, 3);
}

part root {
  place(child) rotateZ(30deg);
}
`);

    expect(placedSketch(ops).placement).toMatchObject({
      faceRef: '0,0,0',
      axisRotationDeg: { z: 30 },
    });
  });
});
