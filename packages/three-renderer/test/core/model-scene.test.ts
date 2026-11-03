/**
 * @author Aidan Boissonneault
 * @file model-scene.test.ts
 * @purpose Tests model mesh ownership and preview rendering setup.
 * @last-edited November 3, 2026
 */

import type { MeshData } from '@bushscad/ir';
import { describe, expect, it } from 'vitest';
import { ModelScene } from '../../src/core/model-scene.js';

describe('model scene mesh rendering', () => {
  it('builds renderable meshes with source indices and style-specific visuals', () => {
    const scene = new ModelScene();
    scene.updateMeshes(
      [mesh('solid'), { ...mesh('surface'), isOpenSurface: true }],
      [4, null],
    );

    const [solid, surface] = previewMeshes(scene);
    expect(solid.userData.interactionMeshIndex).toBe(4);
    expect(surface.userData.interactionMeshIndex).toBeUndefined();
    expect(scene.interactiveMeshes()).toEqual([solid]);
    expect(solid.children).toHaveLength(1);

    scene.setRenderingStyle('realism');
    const [realismSolid, realismSurface] = previewMeshes(scene);
    expect(realismSolid.castShadow).toBe(true);
    expect(realismSurface.castShadow).toBe(false);
    expect(realismSolid.children).toHaveLength(0);

    scene.dispose();
    expect(scene.group.children).toHaveLength(0);
  });
});

/** Finds rendered meshes below the part and explode transform groups. */
function previewMeshes(scene: ModelScene) {
  return scene.group.children.flatMap((explodeGroup) =>
    explodeGroup.children.flatMap((partGroup) => partGroup.children),
  );
}

/** Creates a minimal triangular model mesh for the scene tests. */
function mesh(partName: string): MeshData {
  return {
    partName,
    color: '#336699',
    vertices: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
    normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
    indices: new Uint32Array([0, 1, 2]),
  };
}
