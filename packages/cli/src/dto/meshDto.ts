/**
 * @author Aidan Boissonneault
 * @file meshDto.ts
 * @purpose Provides mesh dto behavior for the dto in cli package.
 * @last-edited October 6, 2026
 */

import { meshPresentationMetadata, type MeshData } from '@bushscad/ir';
import type { MeshDto } from './types.js';

/**
 * Converts internal mesh data into a serializable DTO.
 * Mesh data contains typed arrays which must be converted
 * for JSON transport and service responses.
 */
export function meshToDto(mesh: MeshData): MeshDto {
  return {
    ...meshPresentationMetadata(mesh),
    vertices: Array.from(mesh.vertices),
    normals: Array.from(mesh.normals),
    indices: Array.from(mesh.indices),
    ...(mesh.isHardwareVisual
      ? { isHardwareVisual: true, hardwareKind: mesh.hardwareKind }
      : {}),
  };
}
