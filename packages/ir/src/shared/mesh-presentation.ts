/**
 * @author Aidan Boissonneault
 * @file mesh-presentation.ts
 * @purpose Provides mesh presentation behavior for the shared in IR package.
 * @last-edited October 6, 2026
 */

import type { MeshData } from './ir.js';

/**
 * Type used for metadata for mesh presentation.
 */
export type MeshPresentationMetadata = Pick<
  MeshData,
  'partName' | 'bodyName' | 'color' | 'usesDefaultColor' | 'material'
>;

/**
 * Copies the presentation fields shared by in-memory meshes and transport DTOs.
 * CLI serialization and renderer hydration must preserve the same distinction
 * between authored colors and theme-controlled default colors.
 */
export function meshPresentationMetadata(
  mesh: MeshPresentationMetadata,
): MeshPresentationMetadata {
  return {
    partName: mesh.partName,
    ...(mesh.bodyName ? { bodyName: mesh.bodyName } : {}),
    color: mesh.color,
    ...(mesh.usesDefaultColor ? { usesDefaultColor: true } : {}),
    ...(mesh.material ? { material: mesh.material } : {}),
  };
}
