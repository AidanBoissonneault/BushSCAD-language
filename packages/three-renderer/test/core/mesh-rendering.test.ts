/**
 * @author Aidan Boissonneault
 * @file mesh-rendering.test.ts
 * @purpose Tests mesh rendering behavior in the core in three renderer package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import { resolvedMeshColor } from '../../src/core/mesh-rendering.js';

const THEME_PALETTE = ['#AABBCC', '#DDEEFF'];

describe('mesh rendering colors', () => {
  it('maps bridge defaults to the matching themed palette position', () => {
    expect(
      resolvedMeshColor(
        { color: '#7C3AED', usesDefaultColor: true },
        0,
        THEME_PALETTE,
      ),
    ).toBe('#DDEEFF');
  });

  it('never replaces an explicit model color', () => {
    expect(
      resolvedMeshColor(
        { color: '#7C3AED', usesDefaultColor: false },
        0,
        THEME_PALETTE,
      ),
    ).toBe('#7C3AED');
  });
});
