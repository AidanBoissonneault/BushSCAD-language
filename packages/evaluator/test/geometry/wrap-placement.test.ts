/**
 * @author Aidan Boissonneault
 * @file wrap-placement.test.ts
 * @purpose Tests wrap placement behavior in the geometry in evaluator package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import type { IRCut, IRExtrude } from '@bushscad/ir';
import { evalOps } from '../core/test-support.js';

describe('curved wrap placement syntax', () => {
  it('emits wrapped operations from curved placement arguments', () => {
    const ops = evalOps(`
part p {
    sketch profile = circle(5);
    obj cyl = extrude(profile, 10);
    obj label = cut(profile, 0.5, @cyl.curved(15deg, wrap));
    obj rib = extrude(profile, 1, @cyl.curved(45deg, wrap));
}
`);

    const cut = ops.find((op): op is IRCut => op.kind === 'cut')!;
    const rib = ops.find(
      (op): op is IRExtrude => op.kind === 'extrude' && op.objName === 'rib',
    )!;

    expect(cut.wrap).toBe(true);
    expect(cut.from.surfaceAngleDeg).toBe(15);
    expect(rib.wrap).toBe(true);
    expect(rib.from?.surfaceAngleDeg).toBe(45);
  });
});
