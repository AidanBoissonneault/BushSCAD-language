/**
 * @author Aidan Boissonneault
 * @file profile-region-solids.test.ts
 * @purpose Tests profile region solids behavior in the profiles in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it, vi } from 'vitest';
import { profileSelectionSource, type IRPrimitive } from '@bushscad/ir';
import {
  profileNeedsExactRegionSolid,
  selectedProfileBodyGroups,
} from '../../src/profiles/profile-region-solids.js';
import {
  exactRegionProfileSelectionSource,
  profileSelectionLocalFaceTransform,
} from '../../src/profiles/profile-selection-placement.js';
import type { OC } from '../../src/bridge/bridge-types.js';

/**
 * The profile variant of an IR primitive, used where sketch-preview code needs profile-specific
 * geometry.
 */
type ProfilePrimitive = Extract<IRPrimitive, { kind: 'profile' }>;

const SEGMENTS: ProfilePrimitive['segments'] = [
  { kind: 'line', from: [0, 0], to: [20, 0], name: 'bottom' },
  { kind: 'line', from: [20, 0], to: [20, 20], name: 'right' },
  { kind: 'line', from: [20, 20], to: [0, 20], name: 'top' },
  { kind: 'line', from: [0, 20], to: [0, 0], name: 'left' },
];

/**
 * Creates a minimal profile primitive for exact-region routing tests.
 *
 * Why:
 * The routing decision is independent from live OCCT handles, so these tests
 * keep geometry construction in model-analysis regressions and validate the
 * branch that prevents sampled cells from becoming output geometry.
 */
function profileWithBodies(
  closedBodies: NonNullable<ProfilePrimitive['closedBodies']>,
): ProfilePrimitive {
  return {
    kind: 'profile',
    segments: SEGMENTS,
    closedBodies,
  };
}

describe('profile exact closed-region solids', () => {
  it('keeps simple named one-loop selections on the face path', () => {
    const primitive = profileWithBodies([
      {
        id: 'body_1',
        name: 'tab',
        containsPoint: [10, 10],
        segmentNames: ['bottom', 'right', 'top', 'left'],
        loopIds: ['loop_1'],
      },
    ]);
    primitive.bodySelections = [{ name: 'tab', bodyIds: ['body_1'] }];

    expect(profileNeedsExactRegionSolid(primitive, ['tab'])).toBe(false);
  });

  it('uses exact solids for ignored or overlap-derived regions', () => {
    const primitive = profileWithBodies([
      {
        id: 'body_1',
        containsPoint: [5, 10],
        segmentNames: ['bottom', 'right', 'top', 'left'],
        loopIds: ['loop_1'],
        ignored: true,
      },
      {
        id: 'body_2',
        name: 'overlap',
        containsPoint: [15, 10],
        segmentNames: ['bottom', 'right', 'top', 'left'],
        loopIds: ['loop_1', 'loop_2'],
      },
      {
        id: 'body_3',
        name: 'ring',
        containsPoint: [10, 10],
        segmentNames: ['bottom', 'right', 'top', 'left'],
        loopIds: ['outer'],
        excludedLoopIds: ['inner'],
      },
    ]);

    expect(profileNeedsExactRegionSolid(primitive)).toBe(true);
    expect(profileNeedsExactRegionSolid(primitive, ['overlap'])).toBe(true);
    expect(profileNeedsExactRegionSolid(primitive, ['ring'])).toBe(true);
  });

  it('routes expression-defined body groups through exact solid fusion', () => {
    const primitive: ProfilePrimitive = {
      ...profileWithBodies([
        {
          id: 'body_1',
          segmentNames: ['bottom', 'right', 'top', 'left'],
          loopIds: ['loop_1'],
        },
        {
          id: 'body_2',
          segmentNames: ['bottom', 'right', 'top', 'left'],
          loopIds: ['loop_2'],
        },
      ]),
      bodySelections: [{ name: 'joined', bodyIds: ['body_1', 'body_2'] }],
    };

    expect(profileNeedsExactRegionSolid(primitive, ['joined'])).toBe(true);
    expect(profileNeedsExactRegionSolid(primitive, ['body_1'])).toBe(false);
  });

  it('retains nested local placement while routing expression aliases', () => {
    const profile: ProfilePrimitive = {
      ...profileWithBodies([
        {
          id: 'body_1',
          segmentNames: ['bottom', 'right', 'top', 'left'],
          loopIds: ['loop_1'],
        },
      ]),
      bodySelections: [{ name: 'face', bodyIds: ['body_1'] }],
    };
    const placed: IRPrimitive = {
      kind: 'sketchAt',
      x: 7,
      y: -3,
      primitive: { kind: 'sketchAt', x: 2, y: 5, primitive: profile },
    };

    expect(profileSelectionSource(placed)).toMatchObject({
      profile,
      x: 9,
      y: 2,
    });
    const source = exactRegionProfileSelectionSource(placed, ['face']);
    expect(source).toMatchObject({
      profile,
      x: 9,
      y: 2,
    });
    if (!source) throw new Error('Expected exact placed profile source');
    const face = {} as OC;
    const translated = {} as OC;
    const translate = vi.fn(() => translated);

    expect(profileSelectionLocalFaceTransform(source, translate)?.(face)).toBe(
      translated,
    );
    expect(translate).toHaveBeenCalledWith(face, 9, 2);
  });

  it('prefers a source expression alias over a colliding generated body id', () => {
    const primitive: ProfilePrimitive = {
      ...profileWithBodies([
        {
          id: 'body_1',
          segmentNames: ['bottom', 'right', 'top', 'left'],
          loopIds: ['loop_1'],
        },
      ]),
      bodySelections: [{ name: 'body_1', bodyIds: ['body_1'] }],
    };

    expect(profileNeedsExactRegionSolid(primitive, ['body_1'])).toBe(true);
  });

  it('unions overlapping same-sketch selections by atomic body id', () => {
    const primitive: ProfilePrimitive = {
      ...profileWithBodies([
        {
          id: 'body_1',
          segmentNames: ['bottom', 'right', 'top', 'left'],
          loopIds: ['outer'],
          excludedLoopIds: ['inner'],
        },
        {
          id: 'body_2',
          segmentNames: ['bottom', 'right', 'top', 'left'],
          loopIds: ['outer', 'inner'],
        },
      ]),
      bodySelections: [
        { name: 'outer', bodyIds: ['body_1', 'body_2'] },
        { name: 'hole', bodyIds: ['body_2'] },
      ],
    };

    const groups = selectedProfileBodyGroups(primitive, [
      'outer',
      'hole',
      'outer',
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].map((body) => body.id)).toEqual(['body_1', 'body_2']);
  });
});
