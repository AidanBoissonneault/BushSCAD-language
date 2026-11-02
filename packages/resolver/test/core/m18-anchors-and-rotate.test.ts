/**
 * @author Aidan Boissonneault
 * @file m18-anchors-and-rotate.test.ts
 * @purpose Tests m18 anchors and rotate behavior in the core in resolver package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import { resolveErrors, resolveOk } from './test-support.js';

describe('M18 anchors and rotate', () => {
  it('allows anchors in downstream operations and function arguments', () => {
    resolveOk(`
fn drill(target) {
    sketch h = circle(3);
    return {
        obj h = cut(h, 1 , @target.center),
    }
}
part p {
    sketch profile = rect(20, 10);
    obj base = extrude(profile, 4) {
        @top_face = @base.top;
    }
    place(drill(top_face), @top_face.center);
    rotate base 45deg around top_face.center;
}
`);
  });

  it('reports undefined rotate targets', () => {
    const errors = resolveErrors(`
part p {
    rotate missing 45deg around z;
}
`);
    expect(errors.some((e) => e.includes("Undefined object 'missing'"))).toBe(
      true,
    );
  });
});
