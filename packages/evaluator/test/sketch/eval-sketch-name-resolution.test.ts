/**
 * @author Aidan Boissonneault
 * @file eval-sketch-name-resolution.test.ts
 * @purpose Tests eval sketch name resolution behavior in the sketch in evaluator package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import type { IRExtrude } from '@bushscad/ir';
import { evalOps } from '../core/test-support.js';

describe('sketch name resolution', () => {
  it('keeps same-name sketch and object operands bound to the sketch', () => {
    const ops = evalOps(`
sketch plate = path(
  plant bottom = line((0, 0), (80, 0)),
  right = line((80, 40)),
  top = line((0, 40)),
  left = close(),
  construction center = line((0, 20), (80, 20)),
  constraint(bottom.start, fixed),
  constraint(bottom, horizontal),
  constraint(right, vertical),
  constraint(top, horizontal),
  constraint(left, vertical),
  constraint(bottom, length, 80),
  constraint(right, length, 40)
);

obj plate = extrude(plate, 4);
`);

    const extrude = ops.find((op): op is IRExtrude => op.kind === 'extrude');
    expect(extrude?.objName).toBe('plate');
    expect(extrude?.sketchName).toBe('plate');
  });
});
