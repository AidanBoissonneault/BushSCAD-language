/**
 * @author Aidan Boissonneault
 * @file closed-sketch-bodies.test.ts
 * @purpose Tests closed sketch bodies behavior in the sketch in evaluator package.
 * @last-edited October 6, 2026
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { IRExtrude, IRSketch } from '@bushscad/ir';
import {
  evalOps,
  expectProfileSketch,
  opsOfKind,
} from '../core/test-support.js';

describe('closed sketch bodies evaluation', () => {
  it('treats separate closed path loops as one valid full sketch operand', () => {
    const ops = evalOps(`
sketch plate = path(
  bottom = line((0, 0), (20, 0)),
  right = line((20, 10)),
  top = line((0, 10)),
  left = close(),
  c1 = line((30, 0), (40, 0)),
  c2 = line((40, 10)),
  c3 = line((30, 10)),
  c4 = line((30, 0))
);
obj body = extrude(plate, 2);
`);

    const sketch = expectProfileSketch(opsOfKind<IRSketch>(ops, 'sketch')[0]);
    const extrude = opsOfKind<IRExtrude>(ops, 'extrude')[0];
    expect(extrude?.sketchName).toBe('plate');
    expect(sketch.primitive.closedBodies).toHaveLength(2);
  });

  it('resolves named and ignored closed bodies from point declarations', () => {
    const ops = evalOps(`
sketch plate = path(
  bottom = line((0, 0), (20, 0)),
  right = line((20, 10)),
  top = line((0, 10)),
  left = close(),
  slot = closed(10, 5),
  ignoreClosed(10, 5)
);
obj body = extrude(plate.slot, 2);
`);

    const sketch = expectProfileSketch(opsOfKind<IRSketch>(ops, 'sketch')[0]);
    const extrude = opsOfKind<IRExtrude>(ops, 'extrude')[0];
    expect(extrude?.closedBodyNames).toEqual(['slot']);
    expect(sketch.primitive.closedBodies?.[0]).toMatchObject({
      name: 'slot',
      ignored: true,
      containsPoint: [10, 5],
    });
  });

  it('treats overlapping loop intersections as separate closed bodies', () => {
    const ops = evalOps(`
sketch plate = path(
  a1 = line((0, 0), (20, 0)),
  a2 = line((20, 20)),
  a3 = line((0, 20)),
  a4 = close(),
  b1 = line((10, 0), (30, 0)),
  b2 = line((30, 20)),
  b3 = line((10, 20)),
  b4 = close(),
  overlap = closed(15, 10)
);
obj body = extrude(plate.overlap, 2);
`);

    const sketch = expectProfileSketch(opsOfKind<IRSketch>(ops, 'sketch')[0]);
    const extrude = opsOfKind<IRExtrude>(ops, 'extrude')[0];
    expect(extrude?.closedBodyNames).toEqual(['overlap']);
    expect(sketch.primitive.closedBodies).toHaveLength(3);
    const overlap = sketch.primitive.closedBodies?.find(
      (body) => body.name === 'overlap',
    );
    expect(overlap?.loopIds).toHaveLength(2);
    expect(overlap).not.toHaveProperty('sampleCells');
  });

  it('evaluates the closed-body regression without reporting an open sketch', () => {
    const source = readFileSync(
      new URL(
        '../../../../examples/sketch-closed-body-regression.bscd',
        import.meta.url,
      ),
      'utf8',
    );
    const ops = evalOps(source);
    expect(ops.some((op) => op.kind === 'extrude')).toBe(true);
    const sketch = expectProfileSketch(opsOfKind<IRSketch>(ops, 'sketch')[0]);
    const ignored = sketch.primitive.closedBodies?.filter(
      (body) => body.ignored,
    );
    expect(ignored).toHaveLength(2);
    expect(ignored?.map((body) => body.loopIds?.join('+')).sort()).toEqual([
      'body_1+body_2',
      'body_2+body_3',
    ]);
  });
});
