/**
 * @author Aidan Boissonneault
 * @file rect-side-names.test.ts
 * @purpose Tests rect side names behavior in the sketch in evaluator package.
 * @last-edited October 6, 2026
 */

import type { IRSketch } from '@bushscad/ir';
import { describe, expect, it } from 'vitest';
import { evalOk } from '../core/test-support.js';

/**
 * Handles evaluated sketches in the sketch flow.
 */
function evaluatedSketches(source: string): IRSketch[] {
  return evalOk(source).program.ops.filter(
    (operation): operation is IRSketch => operation.kind === 'sketch',
  );
}

describe('rectangle side-name evaluation', () => {
  it('copies aliases from the rectangle AST into evaluated IR', () => {
    const [plate] = evaluatedSketches(
      'sketch plate = rect(80, 40, bottom: mount_edge, top: cap_edge);',
    );

    expect(plate.primitive).toEqual({
      kind: 'rect',
      width: 80,
      height: 40,
      sideNames: { bottom: 'mount_edge', top: 'cap_edge' },
    });
  });

  it('deep-copies aliases when evaluating a sketch reference', () => {
    const [base, copy] = evaluatedSketches(`
sketch base = rect(80, 40, bottom: mount_edge);
sketch copy = base;
`);

    expect(copy.primitive).toMatchObject({
      kind: 'rect',
      sideNames: { bottom: 'mount_edge' },
    });
    if (base.primitive.kind === 'rect' && copy.primitive.kind === 'rect') {
      expect(copy.primitive.sideNames).not.toBe(base.primitive.sideNames);
    }
  });

  it('preserves aliases through exact rectangle offsets', () => {
    const [expanded] = evaluatedSketches(`
sketch expanded = offset(
  rect(80, 40, bottom: mount_edge),
  2
);
`);

    expect(expanded.primitive).toMatchObject({
      kind: 'rect',
      width: 84,
      height: 44,
      sideNames: { bottom: 'mount_edge' },
    });
  });
});
