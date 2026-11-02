/**
 * @author Aidan Boissonneault
 * @file relative-angle-constraints.test.ts
 * @purpose Tests relative angle constraints behavior in the sketch in parser package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import { parse } from '../../src/index.js';

describe('relative angle syntax', () => {
  it('parses driving and reference angles while preserving absolute syntax', () => {
    const result = parse(
      `
sketch angles = path(
  reference = line((0, 0), (20, 0)),
  driven = line((30, 0), (40, 10)),
  close(),
  constraint(driven, angle, reference, 45deg, at: (25, 8)),
  constraint(reference, angle, 0deg),
  dimension driven.angle to reference at (25, 12)
);`,
      'relative-angle.bscd',
    );

    expect(result.errors).toEqual([]);
    const sketch = result.ast.statements[0];
    expect(sketch.kind).toBe('sketch');
    if (sketch.kind !== 'sketch' || sketch.primitive.kind !== 'pathSketch')
      return;
    expect(sketch.primitive.constraints).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          constraint: 'angle',
          target: 'driven',
          ref: 'reference',
        }),
        expect.objectContaining({ constraint: 'angle', target: 'reference' }),
      ]),
    );
    expect(sketch.primitive.dimensions[0]).toMatchObject({
      dimension: 'angle',
      target: 'driven',
      ref: 'reference',
    });
  });
});
