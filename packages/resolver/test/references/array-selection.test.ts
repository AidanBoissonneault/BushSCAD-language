/**
 * @author Aidan Boissonneault
 * @file array-selection.test.ts
 * @purpose Tests array selection behavior in the references in resolver package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import { resolveErrors } from '../core/test-support.js';

describe('array selector resolution', () => {
  it('resolves every root in grouped and listed selectors', () => {
    const errors = resolveErrors(`
part p {
  sketch s = rect(10, 10);
  obj body1 = extrude(s, 1);
  obj body2 = extrude(s, 1);
  fillet(@[body1, body2].[top, bottom].edges, 1);
  chamfer([@body1.top.edges, @body2.bottom.edges], 0.5);
}
`);
    expect(errors).toHaveLength(0);
  });

  it('reports undefined roots inside grouped selectors', () => {
    expect(
      resolveErrors(`
part p {
  sketch s = rect(10, 10);
  obj body = extrude(s, 1);
  fillet(@[body, missing].top.edges, 1);
}
`),
    ).toContain("Undefined reference 'missing'");
  });

  it('allows selector-name arrays stored in variables', () => {
    const errors = resolveErrors(`
part p {
  var sides = [top, bottom];
  sketch s = rect(10, 10);
  obj body = extrude(s, 1);
  obj pocket = cut(circle(1), 0.5, @body.sides);
  fillet(@body.sides.edges, 1);
}
`);
    expect(errors).toHaveLength(0);
  });

  it('allows selector variables with non-reserved names', () => {
    const errors = resolveErrors(`
part p {
  var caps = [top, bottom];
  sketch s = rect(10, 10);
  obj body = extrude(s, 1);
  fillet(@body.caps.edges, 1);
}
`);
    expect(errors).toHaveLength(0);
  });

  it('allows explicit reference arrays stored in variables', () => {
    const errors = resolveErrors(`
part p {
  sketch s = rect(10, 10);
  obj body = extrude(s, 1);
  var targets = [@body.top, @body.bottom];
  fillet(@targets.edges, 1);
}
`);
    expect(errors).toHaveLength(0);
  });

  it('resolves indexed generated object-array references', () => {
    const errors = resolveErrors(`
part p {
  sketch base = rect(10, 10);
  sketch h = circle(1);
  obj body = extrude(base, 1);
  obj pocket = cut(h, 0.5, @body.[top, bottom]);
  fillet(@pocket[1].edges, 1);
}
`);
    expect(errors).toHaveLength(0);
  });

  it('resolves roots around wildcard selectors', () => {
    const errors = resolveErrors(`
part p {
  sketch s = rect(10, 10);
  obj body = extrude(s, 1);
  fillet(@body.*.edges, 1);
}
`);
    expect(errors).toHaveLength(0);
  });

  it('reports undefined roots around wildcard selectors', () => {
    expect(
      resolveErrors(`
part p {
  sketch s = rect(10, 10);
  obj body = extrude(s, 1);
  fillet(@missing.*.edges, 1);
}
`),
    ).toContain("Undefined reference 'missing'");
  });
});
