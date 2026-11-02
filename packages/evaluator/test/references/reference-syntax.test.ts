/**
 * @author Aidan Boissonneault
 * @file reference-syntax.test.ts
 * @purpose Tests reference syntax behavior in the references in evaluator package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import type { IRChamfer, IRFillet } from '@bushscad/ir';
import { evalOps } from '../core/test-support.js';

describe('anchor-centric reference evaluation', () => {
  it('canonicalizes direct edge and corner aliases for modifiers', () => {
    const ops = evalOps(`
part p {
  sketch b = rect(20, 10);
  obj b = extrude(b, 2);
  fillet(@b.top.front_edge, 1);
  chamfer(@b.top.front_left, 0.5);
}
`);
    const fillet = ops.find((op): op is IRFillet => op.kind === 'fillet')!;
    const chamfer = ops.find((op): op is IRChamfer => op.kind === 'chamfer')!;

    expect(fillet.target).toBe('b.top.edge.front');
    expect(chamfer.target).toBe('b.top.corner.front_left');
  });

  it('canonicalizes dot-style named faces', () => {
    const ops = evalOps(`
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
    const fillet = ops.find((op): op is IRFillet => op.kind === 'fillet')!;
    expect(fillet.target).toBe('vase.face.lip.edges');
  });

  it('preserves object-wide and bare modifier targets for topology inference', () => {
    const ops = evalOps(`
part p {
  obj body = extrude(rect(20, 10), 4);
  fillet(@body.perimeter, 1);
  chamfer(@body, 0.5);
}
`);
    const fillet = ops.find((op): op is IRFillet => op.kind === 'fillet')!;
    const chamfer = ops.find((op): op is IRChamfer => op.kind === 'chamfer')!;

    expect(fillet.target).toBe('body.perimeter');
    expect(chamfer.target).toBe('body');
  });

  it('emits typed edge-intersection intent and its result index', () => {
    const ops = evalOps(`
part p {
  sketch profile = rect(20, 10, right: first) + rect(10, 20, top: second);
  obj body = extrude(profile, 4);
  fillet(@body.(first, second)[0], 1);
}
`);
    const fillet = ops.find((op): op is IRFillet => op.kind === 'fillet')!;

    expect(fillet.target).toBe('body.(first, second)[0]');
    expect(fillet.selection).toMatchObject({
      selectorKind: 'edge-intersection',
      topologyKind: 'edge',
      edgeIntersection: {
        edgeLabels: ['body.first', 'body.second'],
        index: 0,
      },
    });
  });

  it('emits exact sketch-component edge intent for a direct member', () => {
    const ops = evalOps(`
part p {
  sketch profile = rect(20, 10) as outer + rect(10, 20) as inner;
  obj body = extrude(profile, 4);
  fillet(@body.outer.top, 1);
}
`);
    const fillet = ops.find((op): op is IRFillet => op.kind === 'fillet')!;

    expect(fillet.target).toBe('body.outer.top');
    expect(fillet.selection).toMatchObject({
      selectorKind: 'named-edge',
      topologyKind: 'edge',
      sketchComponent: {
        componentPath: ['outer'],
        member: 'top',
      },
    });
  });

  it('intersects two unscoped edge aliases on their common object', () => {
    const ops = evalOps(`
part p {
  sketch profile = rect(20, 10, right: first) + rect(10, 20, top: second);
  obj body = extrude(profile, 4);
  @edge1 = @body.first;
  @edge2 = @body.second;
  fillet(@(edge1, edge2)[0], 1);
}
`);
    const fillet = ops.find((op): op is IRFillet => op.kind === 'fillet')!;

    expect(fillet.selection?.edgeIntersection).toEqual({
      edgeLabels: ['body.face.first', 'body.face.second'],
      index: 0,
    });
  });
});
