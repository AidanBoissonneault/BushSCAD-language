/**
 * @author Aidan Boissonneault
 * @file profile-selection-placement.test.ts
 * @purpose Tests profile selection placement behavior in the profiles in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it, vi } from 'vitest';
import type { IRPrimitive, SourceSpan } from '@bushscad/ir';
import type { OC } from '../../src/bridge/bridge-types.js';

const mocks = vi.hoisted(() => ({
  buildProfileFaceForPrimitive: vi.fn(),
}));

vi.mock('../../src/profiles/profile-faces.js', () => ({
  buildProfileFaceForPrimitive: mocks.buildProfileFaceForPrimitive,
}));

import { buildPlacedSelectedProfileFace } from '../../src/profiles/profile-selection-placement.js';

const SPAN: SourceSpan = {
  file: 'placed-profile.bscd',
  line: 1,
  col: 1,
  endLine: 1,
  endCol: 10,
};

const PROFILE: Extract<IRPrimitive, { kind: 'profile' }> = {
  kind: 'profile',
  segments: [],
  closedBodies: [
    { id: 'body_1', name: 'face', segmentNames: [], loopIds: ['loop_1'] },
  ],
};

describe('placed profile body selection', () => {
  it('reapplies accumulated local placement to a rebuilt selected face', () => {
    const face = { delete: vi.fn() } as unknown as OC;
    const translated = {} as OC;
    const oc = {} as OC;
    const translate = vi.fn(() => translated);
    mocks.buildProfileFaceForPrimitive.mockReturnValue(face);
    const primitive: IRPrimitive = {
      kind: 'sketchAt',
      x: 7,
      y: -3,
      primitive: { kind: 'sketchAt', x: 2, y: 5, primitive: PROFILE },
    };

    expect(
      buildPlacedSelectedProfileFace({
        oc,
        primitive,
        sketchName: 'profile',
        selectedNames: ['face'],
        span: SPAN,
        translate,
      }),
    ).toBe(translated);
    expect(mocks.buildProfileFaceForPrimitive).toHaveBeenCalledWith(
      oc,
      PROFILE,
      SPAN,
      ['face'],
    );
    expect(translate).toHaveBeenCalledWith(face, 9, 2);
    expect(face.delete).toHaveBeenCalledOnce();
  });

  it('keeps an unplaced selected face without an extra transform', () => {
    const face = { delete: vi.fn() } as unknown as OC;
    const translate = vi.fn();
    mocks.buildProfileFaceForPrimitive.mockReturnValue(face);

    expect(
      buildPlacedSelectedProfileFace({
        oc: {} as OC,
        primitive: PROFILE,
        sketchName: 'profile',
        selectedNames: ['face'],
        span: SPAN,
        translate,
      }),
    ).toBe(face);
    expect(translate).not.toHaveBeenCalled();
    expect(face.delete).not.toHaveBeenCalled();
  });

  it('does not delete a face when a translator returns the same handle', () => {
    const face = { delete: vi.fn() } as unknown as OC;
    mocks.buildProfileFaceForPrimitive.mockReturnValue(face);

    expect(
      buildPlacedSelectedProfileFace({
        oc: {} as OC,
        primitive: { kind: 'sketchAt', x: 2, y: 3, primitive: PROFILE },
        sketchName: 'profile',
        selectedNames: ['face'],
        span: SPAN,
        translate: () => face,
      }),
    ).toBe(face);
    expect(face.delete).not.toHaveBeenCalled();
  });
});
