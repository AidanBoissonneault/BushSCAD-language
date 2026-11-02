/**
 * @author Aidan Boissonneault
 * @file path-duplicate-names.test.ts
 * @purpose Tests path duplicate names behavior in the sketch in evaluator package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import type { IRSketch } from '@bushscad/ir';
import { parse } from '@bushscad/parser';
import { resolve } from '@bushscad/resolver';
import { evaluate } from '../../src/index.js';

/**
 * Handles no files in the sketch flow.
 */
const noFiles = () => null;

describe('path duplicate segment names', () => {
  it('suffixes repeated edge names instead of rejecting the sketch', () => {
    const parsed = parse(
      `
sketch plate = path(
  bottom = line((0, 0), (10, 0)),
  right = line((10, 10)),
  top = line((0, 10)),
  left = close(),
  bottom = line((20, 0), (30, 0)),
  right = line((30, 10)),
  top = line((20, 10)),
  left = close()
);
obj body = extrude(plate, 2);
`,
      'duplicate-path-names.bscd',
    );
    expect(parsed.errors.map((error) => error.message)).toEqual([]);

    const resolved = resolve(
      parsed.ast,
      'duplicate-path-names.bscd',
      noFiles,
    );
    expect(resolved.errors.map((error) => error.message)).toEqual([]);
    const result = evaluate(resolved.ast);

    expect(result.errors.map((error) => error.message)).toEqual([]);
    const sketch = result.program.ops.find(
      (op): op is IRSketch => op.kind === 'sketch',
    );
    expect(sketch?.primitive.kind).toBe('profile');
    if (sketch?.primitive.kind !== 'profile') return;
    expect(sketch.primitive.segments.map((segment) => segment.name)).toEqual([
      'bottom',
      'right',
      'top',
      'left',
      'bottom_2',
      'right_2',
      'top_2',
      'left_2',
    ]);
  });
});
