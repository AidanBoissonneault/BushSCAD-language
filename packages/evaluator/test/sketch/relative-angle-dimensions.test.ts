/**
 * @author Aidan Boissonneault
 * @file relative-angle-dimensions.test.ts
 * @purpose Tests relative angle dimensions behavior in the sketch in evaluator package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import type { IRSketch } from '@bushscad/ir';
import { parse } from '@bushscad/parser';
import { resolve } from '@bushscad/resolver';
import { evaluate } from '../../src/index.js';

describe('relative angle evaluation', () => {
  it('solves and emits relative driving and reference angle metadata', () => {
    const parsed = parse(
      `
sketch angles = path(
  reference = line((0, 0), (20, 0)),
  driven = line((30, 0), (44, 14)),
  side = line((30, 20)),
  close(),
  constraint(reference.start, fixed),
  constraint(reference, horizontal),
  constraint(driven.start, fixed),
  constraint(driven, length, 20),
  constraint(driven, angle, reference, 45deg, at: (25, 8)),
  dimension driven.angle to reference at (25, 12),
  dimension reference.angle at (10, -6)
);`,
      'relative-angle.bscd',
    );
    expect(parsed.errors).toEqual([]);
    const resolved = resolve(parsed.ast, 'relative-angle.bscd', () => null);
    expect(resolved.errors).toEqual([]);
    const evaluated = evaluate(resolved.ast);
    expect(evaluated.errors).toEqual([]);
    const sketch = evaluated.program.ops.find(
      (op): op is IRSketch => op.kind === 'sketch',
    );
    expect(sketch?.primitive.kind).toBe('profile');
    if (sketch?.primitive.kind !== 'profile') return;
    expect(sketch.primitive.dimensions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          mode: 'driving',
          dimension: 'angle',
          ref: 'reference',
          value: 45,
        }),
        expect.objectContaining({
          mode: 'reference',
          dimension: 'angle',
          ref: 'reference',
          value: 45,
        }),
        expect.objectContaining({
          mode: 'reference',
          dimension: 'angle',
          target: 'reference',
          value: 0,
        }),
      ]),
    );
  });
});
