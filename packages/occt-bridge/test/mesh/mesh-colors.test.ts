/**
 * @author Aidan Boissonneault
 * @file mesh-colors.test.ts
 * @purpose Tests mesh colors behavior in the mesh in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it, vi } from 'vitest';
import { resolvePartMeshColor } from '../../src/mesh/mesh-colors.js';

describe('mesh color provenance', () => {
  it('marks generated palette colors as defaults', () => {
    expect(resolvePartMeshColor(null, () => '#2563EB')).toEqual({
      color: '#2563EB',
      usesDefaultColor: true,
    });
  });

  it('preserves explicit colors without consuming the palette', () => {
    const nextColor = vi.fn(() => '#2563EB');

    expect(resolvePartMeshColor('#112233', nextColor)).toEqual({
      color: '#112233',
      usesDefaultColor: false,
    });
    expect(nextColor).not.toHaveBeenCalled();
  });
});
