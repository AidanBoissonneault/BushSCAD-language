/**
 * @author Aidan Boissonneault
 * @file modifier-deferral.test.ts
 * @purpose Tests modifier deferral behavior in the operations in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import {
  requiresFusedSourceEdgeRecovery,
  splitDeferredPartModifiers,
} from '../../src/operations/modifier-deferral.js';
import type { IRFillet } from '@bushscad/ir';
import type { GroupBuildState } from '../../src/bridge/bridge-types.js';

const SPAN = { file: 'test.bscd', line: 1, col: 1 };

/**
 * Handles fillet in the operations flow.
 */
function fillet(target: string): IRFillet {
  return { kind: 'fillet', target, radius: 0.5, span: SPAN };
}

/**
 * Builds the minimal state needed by modifier deferral decisions.
 *
 * Why:
 * These tests are about source-edge recovery policy, not OCCT shape state, so
 * the unused bridge fields are intentionally omitted from the fixture.
 */
function deferralState(attachedName: string): GroupBuildState {
  return {
    partSolidOwner: 'part',
    partSolidComponents: new Map([
      ['part', {}],
      [attachedName, {}],
      ['other', {}],
    ]),
    bodyEdgeModes: new Map([[attachedName, 'outer']]),
    partSolidAliasAttachmentPlanes: new Map([
      [
        attachedName,
        {
          origin: [0, 0, 0],
          normal: [0, 0, 1],
        },
      ],
    ]),
    bodyAttachmentPlanes: new Map(),
  } as unknown as GroupBuildState;
}

describe('modifier deferral', () => {
  it('keeps placed additive top-edge fillets on the deferred component', () => {
    const state = deferralState('badge');

    expect(
      requiresFusedSourceEdgeRecovery(state, [fillet('badge.top.edges')]),
    ).toBe(false);
    expect(
      splitDeferredPartModifiers(state, [
        fillet('body.top.edges'),
        fillet('badge.top.edges'),
      ]),
    ).toEqual({
      deferredPrefix: [fillet('body.top.edges'), fillet('badge.top.edges')],
      fusedSuffix: [],
    });
  });

  it('splits at placed additive bottom-edge fillets for fused seam recovery', () => {
    const state = deferralState('flange');
    const baseTop = fillet('base.top.edges');
    const flangeBottom = fillet('flange.bottom.edges');

    expect(requiresFusedSourceEdgeRecovery(state, [flangeBottom])).toBe(true);
    expect(splitDeferredPartModifiers(state, [baseTop, flangeBottom])).toEqual({
      deferredPrefix: [baseTop],
      fusedSuffix: [flangeBottom],
    });
  });
});
