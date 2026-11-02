/**
 * @author Aidan Boissonneault
 * @file errors.test.ts
 * @purpose Tests errors behavior in the core in resolver package.
 * @last-edited October 6, 2026
 */

import { parse } from '@bushscad/parser';
import { describe, expect, it } from 'vitest';
import { resolve } from '../../src/index.js';
import { noFiles, resolveErrors } from './test-support.js';

describe('resolver errors', () => {
  it('undefined variable', () => {
    const errors = resolveErrors('var x = missing_var;');
    expect(errors.some((e) => e.includes("'missing_var'"))).toBe(true);
  });

  it('undefined sketch in extrude', () => {
    const errors = resolveErrors('obj box = extrude(missing_sketch, 10);');
    expect(errors.some((e) => e.includes("'missing_sketch'"))).toBe(true);
  });

  it('undefined object in through-cut', () => {
    const errors = resolveErrors(`
sketch h = circle(3);
obj h = cut(h, through nonexistent , @h.top.center);
`);
    expect(errors.some((e) => e.includes("'nonexistent'"))).toBe(true);
  });

  it('bad cross-part ref — part does not exist', () => {
    const errors = resolveErrors(`
part lid {
    sketch face = rect(100, 80);
    obj face = extrude(face, 3 , @nonexistent_part.top.center);
}
`);
    expect(errors.some((e) => e.includes("'nonexistent_part'"))).toBe(true);
  });

  it('this. at top level', () => {
    const errors = resolveErrors('sketch s = rect(this.width, 10);');
    expect(errors.some((e) => e.includes('this.'))).toBe(true);
  });

  it('undefined plane in chain', () => {
    const errors = resolveErrors(`
part p {
    sketch b = rect(1, 1);
    obj b = extrude(b, 5);
    plane lvl2 = offset(10 , @ghost_plane);
}
`);
    expect(errors.some((e) => e.includes("'ghost_plane'"))).toBe(true);
  });

  it('undefined component in place', () => {
    const errors = resolveErrors(`
part p {
    sketch b = rect(1, 1);
    obj b = extrude(b, 5);
    place(ghost_comp, @b.top.center);
}
`);
    expect(errors.some((e) => e.includes("'ghost_comp'"))).toBe(true);
  });

  it('never throws — returns errors array', () => {
    const parsed = parse('obj x = extrude(missing, 10);', 'test.bscd');
    const result = resolve(parsed.ast, 'test.bscd', noFiles);
    expect(Array.isArray(result.errors)).toBe(true);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('returns original ast unchanged', () => {
    const parsed = parse('var x = 5;', 'test.bscd');
    const result = resolve(parsed.ast, 'test.bscd', noFiles);
    expect(result.ast).toBe(parsed.ast);
  });
});
