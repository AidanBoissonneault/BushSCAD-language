/**
 * @author Aidan Boissonneault
 * @file mesh-rendering.ts
 * @purpose Provides mesh rendering behavior for the core in three renderer package.
 * @last-edited October 6, 2026
 */

import * as THREE from 'three';
import type { MeshData } from '@bushscad/ir';

export const MESH_PALETTE = [
  '#2563EB',
  '#7C3AED',
  '#059669',
  '#DC2626',
  '#D97706',
  '#0891B2',
  '#BE185D',
  '#0D9488',
];

/** Selects themed colors only for meshes marked as bridge-generated defaults. */
export function resolvedMeshColor(
  mesh: Pick<MeshData, 'color' | 'usesDefaultColor'>,
  meshIndex: number,
  themedPalette: readonly string[],
): string {
  const fallbackPalette =
    themedPalette.length > 0 ? themedPalette : MESH_PALETTE;
  if (!mesh.usesDefaultColor) {
    return mesh.color || fallbackPalette[meshIndex % fallbackPalette.length];
  }
  const sourceIndex = MESH_PALETTE.findIndex(
    (color) => color.toLowerCase() === mesh.color.toLowerCase(),
  );
  const paletteIndex = sourceIndex >= 0 ? sourceIndex : meshIndex;
  return fallbackPalette[paletteIndex % fallbackPalette.length];
}

/**
 * Disposes generated mesh resources before replacing preview geometry.
 * The renderer rebuilds geometry on each compile, so GPU buffers and materials
 * must be explicitly released outside the main orchestration class.
 */
export function disposeMeshGroup(meshGroup: THREE.Group): void {
  meshGroup.traverse((child) => {
    if (child instanceof THREE.Mesh || child instanceof THREE.LineSegments) {
      child.geometry.dispose();
      const material = child.material;
      if (Array.isArray(material)) material.forEach((mat) => mat.dispose());
      else material.dispose();
    }
  });
}

/**
 * Creates the CAD-mode edge overlay for a generated mesh.
 * Edge styling is shared rendering policy and should stay separate from mesh
 * lifecycle and camera control code.
 */
export function createCadEdgeOverlay(
  geometry: THREE.BufferGeometry,
): THREE.LineSegments {
  return new THREE.LineSegments(
    new THREE.EdgesGeometry(geometry, 20),
    new THREE.LineBasicMaterial({
      color: 0x243244,
      transparent: true,
      opacity: 0.38,
      depthWrite: false,
    }),
  );
}
