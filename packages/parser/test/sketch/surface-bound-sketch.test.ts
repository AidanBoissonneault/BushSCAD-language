/**
 * @author Aidan Boissonneault
 * @file surface-bound-sketch.test.ts
 * @purpose Tests surface bound sketch behavior in the sketch in parser package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import type { FaceRef } from '@bushscad/ir';
import { parse } from '../../src/core/parser.js';

/**
 * Parses ok from the supplied source into the sketch representation.
 */
function parseOk(src: string): ReturnType<typeof parse>['ast'] {
  const result = parse(src, 'surface-bound-sketch.bscd');
  expect(result.errors).toEqual([]);
  return result.ast;
}

describe('surface-bound sketches', () => {
  it('parses @ face sketch placement as a distinct placement mode', () => {
    const ast = parseOk(`
sketch s = rect(80, 80, @base.top);
`);
    const sketch = ast.statements[0];
    expect(sketch.kind).toBe('sketch');
    if (sketch.kind !== 'sketch') return;
    expect(sketch.placement?.mode).toBe('on');
    expect(
      (sketch.placement?.face as FaceRef).chain.map((segment) =>
        segment.kind === 'name'
          ? segment.value
          : segment.kind === 'edgeIntersection'
            ? `(${segment.edges.join(',')})`
            : segment.kind === 'group'
              ? segment.options.join(',')
              : segment.kind === 'index'
                ? String(segment.value)
                : segment.kind === 'wildcard'
                  ? '*'
                  : segment.name,
      ),
    ).toEqual(['base', 'top']);
  });

  it('keeps @ sketch arguments as placement-only sketches', () => {
    const ast = parseOk(`
sketch s = rect(20, 20, @base.top);
`);
    const sketch = ast.statements[0];
    expect(sketch.kind).toBe('sketch');
    if (sketch.kind !== 'sketch') return;
    expect(sketch.placement?.mode).toBe('on');
  });
});
