/**
 * @author Aidan Boissonneault
 * @file mesh-rendering.test.ts
 * @purpose Tests mesh rendering behavior in the core in three renderer package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import type { MeshData } from '@bushscad/ir';
import {
  createPreviewMesh,
  resolvedMeshColor,
} from '../../src/core/mesh-rendering.js';

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

describe('preview mesh construction', () => {
  it('applies the requested render style and source mesh identity', () => {
    const cadMesh = createPreviewMesh(
      renderMesh(),
      0,
      3,
      THEME_PALETTE,
      'cad',
    );
    expect(cadMesh.userData.interactionMeshIndex).toBe(3);
    expect(cadMesh.children).toHaveLength(1);
    expect(cadMesh.castShadow).toBe(false);

    const realismMesh = createPreviewMesh(
      renderMesh(),
      0,
      null,
      THEME_PALETTE,
      'realism',
    );
    expect(realismMesh.userData.interactionMeshIndex).toBeUndefined();
    expect(realismMesh.children).toHaveLength(0);
    expect(realismMesh.castShadow).toBe(true);
  });

  it('does not add solid-only effects to open surfaces', () => {
    const surface = createPreviewMesh(
      { ...renderMesh(), isOpenSurface: true },
      0,
      null,
      THEME_PALETTE,
      'cad',
    );
    expect(surface.children).toHaveLength(0);
    expect(surface.castShadow).toBe(false);
  });
});

/** Creates a minimal mesh for preview construction tests. */
function renderMesh(): MeshData {
  return {
    partName: 'part',
    color: '#336699',
    vertices: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
    normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
    indices: new Uint32Array([0, 1, 2]),
  };
}
