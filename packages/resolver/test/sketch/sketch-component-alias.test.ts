/**
 * @author Aidan Boissonneault
 * @file sketch-component-alias.test.ts
 * @purpose Tests sketch component alias behavior in the sketch in resolver package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import { resolveErrors, resolveOk } from '../core/test-support.js';

describe('sketch component aliases', () => {
  it('resolves rectangle defaults directly and in edge intersections', () => {
    resolveOk(`
part aliases {
  sketch crossed = rect(60, 20) as horizontal + rect(20, 60) as vertical;
  obj body = extrude(crossed, 8);
  chamfer(@body.horizontal.bottom, 1);
  fillet(@body.(horizontal.top, vertical.right)[0], 2);
}
`);
  });

  it('diagnoses an unknown member below a known component', () => {
    const errors = resolveErrors(`
part aliases {
  sketch crossed = rect(60, 20) as horizontal + rect(20, 60) as vertical;
  obj body = extrude(crossed, 8);
  fillet(@body.horizontal.diagonal, 1);
}
`);

    expect(errors).toContain(
      "Unknown member 'diagonal' on sketch component 'horizontal' of object 'body'",
    );
  });

  it('diagnoses duplicate aliases across Boolean branches', () => {
    const errors = resolveErrors(`
sketch crossed = rect(60, 20) as bar + rect(20, 60) as bar;
`);

    expect(errors).toContain("Duplicate sketch component alias 'bar'");
  });
});
