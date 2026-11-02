/**
 * @author Aidan Boissonneault
 * @file reference-syntax.test.ts
 * @purpose Tests reference syntax behavior in the references in resolver package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import { resolveErrors } from '../core/test-support.js';

describe('anchor-centric reference resolution', () => {
  it('accepts dot-style named faces declared by path segments', () => {
    const errors = resolveErrors(`
part p {
  sketch profile = path(
    a = line((0,0), (20,0)),
    lip = arc((20,0), (20,8), 8, cw),
    back = line((20,8), (0,8)),
    close = line((0,8), (0,0))
  );
  obj vase = revolve(profile, 360deg around y);
  fillet(@vase.lip.edges, 0.5);
}
`);
    expect(errors).toHaveLength(0);
  });

  it('reports missing dot-style named faces on known objects', () => {
    const errors = resolveErrors(`
part p {
  sketch profile = path(
    a = line((0,0), (20,0)),
    b = line((20,0), (20,8)),
    c = line((20,8), (0,8)),
    d = line((0,8), (0,0))
  );
  obj vase = revolve(profile, 360deg around y);
  fillet(@vase.missing.edges, 0.5);
}
`);
    expect(errors).toContain("Unknown named face 'missing' on object 'vase'");
  });

  it('accepts bare relative named-face anchors in ref bodies', () => {
    const errors = resolveErrors(`
part p {
  sketch profile = path(
    foot = line((0,0), (20,0)),
    wall = line((20,0), (20,8)),
    top = line((20,8), (0,8)),
    close = line((0,8), (0,0))
  );
  obj vase = revolve(profile, 360deg around y);
}

ref vase_ref extends vase {
  @foot_mount = @foot.center;
}
`);
    expect(errors).toHaveLength(0);
  });

  it('accepts object-wide and inferred-edge modifier targets', () => {
    const errors = resolveErrors(`
part p {
  obj body = extrude(rect(20, 10), 4);
  fillet(@body.perimeter, 1);
  fillet(@body.edges, 1);
  chamfer(@body, 0.5);
}
`);
    expect(errors).toHaveLength(0);
  });
});
