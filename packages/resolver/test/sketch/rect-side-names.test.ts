/**
 * @author Aidan Boissonneault
 * @file rect-side-names.test.ts
 * @purpose Tests rect side names behavior in the sketch in resolver package.
 * @last-edited October 6, 2026
 */

import { describe, it } from 'vitest';
import { resolveOk } from '../core/test-support.js';

describe('rectangle side-name resolution', () => {
  it('does not resolve side aliases as variables', () => {
    resolveOk(`
sketch plate = rect(
  80,
  40,
  bottom: undeclared_mount_edge,
  top: undeclared_cap_edge
);
`);
  });

  it('exposes side names to downstream object edge references', () => {
    resolveOk(`
sketch plate = (rect(80, 40, bottom: mount_edge) at (2, 0)) - circle(10);
obj body = extrude(plate, 5);
fillet(@body.mount_edge.edges, 1);
`);
  });

  it('carries side names through derived sketch references', () => {
    resolveOk(`
sketch source = rect(80, 40, bottom: mount_edge);
sketch placed = source at (4, 2);
obj body = extrude(placed, 5);
fillet(@body.mount_edge.edges, 1);
`);
  });

  it('exposes side names from sketches declared inside a part', () => {
    resolveOk(`
part plate_part {
  sketch plate = rect(80, 40, bottom: mount_edge);
  obj body = extrude(plate, 5);
  fillet(@body.mount_edge.edges, 1);
}
`);
  });
});
