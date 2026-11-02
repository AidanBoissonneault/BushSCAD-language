/**
 * @author Aidan Boissonneault
 * @file drawing-view-geometry.ts
 * @purpose Provides drawing view geometry behavior for the drawing in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

import type { ViewFace } from '@bushscad/ir';

/** Project a 3D point onto the 2D drawing plane for the requested view. */
export function projectPoint(
  x: number,
  y: number,
  z: number,
  face: ViewFace,
): [number, number] {
  switch (face) {
    case 'top':
      return [x, y];
    case 'bottom':
      return [x, -y];
    case 'front':
      return [x, z];
    case 'back':
      return [-x, z];
    case 'right':
      return [-y, z];
    case 'left':
      return [y, z];
  }
}

/** Unit vector pointing from the object toward the viewer for each view. */
export function viewDirectionVector(
  viewFace: ViewFace,
): [number, number, number] {
  switch (viewFace) {
    case 'top':
      return [0, 0, 1];
    case 'bottom':
      return [0, 0, -1];
    case 'front':
      return [0, -1, 0];
    case 'back':
      return [0, 1, 0];
    case 'right':
      return [1, 0, 0];
    case 'left':
      return [-1, 0, 0];
  }
}
