/**
 * @author Aidan Boissonneault
 * @file profile-open.test.ts
 * @purpose Tests profile open behavior in the profiles in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import type { IRPrimitive } from '@bushscad/ir';
import { isOpenProfile } from '../../src/profiles/profile-open.js';

const closedProfileWithConstruction = {
  kind: 'profile',
  segments: [
    { kind: 'line', from: [0, 0], to: [80, 0], name: 'bottom' },
    { kind: 'line', from: [80, 0], to: [80, 40], name: 'right' },
    { kind: 'line', from: [80, 40], to: [0, 40], name: 'top' },
    { kind: 'line', from: [0, 40], to: [0, 0], name: 'left' },
    {
      kind: 'line',
      from: [0, 20],
      to: [80, 20],
      name: 'center',
      construction: true,
    },
  ],
} satisfies IRPrimitive;

describe('profile open state', () => {
  it('ignores construction segments when checking closed solid loops', () => {
    expect(isOpenProfile(closedProfileWithConstruction)).toBe(false);
  });
});
