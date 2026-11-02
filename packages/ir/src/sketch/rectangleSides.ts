/**
 * @author Aidan Boissonneault
 * @file rectangleSides.ts
 * @purpose Provides rectangle sides behavior for the sketch in IR package.
 * @last-edited October 6, 2026
 */

import type { RectSide } from '../ast/sketchPrimitives.js';

/**
 * Returns one directed edge of a centered counterclockwise rectangle.
 * Plant anchors and OCCT side aliases must use identical endpoint orientation;
 * one shared contract prevents placement normals from diverging from topology
 * labels when rectangle behavior changes.
 */
export function rectangleSideEndpoints(
  width: number,
  height: number,
  side: RectSide,
): [[number, number], [number, number]] {
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const endpoints: Record<RectSide, [[number, number], [number, number]]> = {
    bottom: [
      [-halfWidth, -halfHeight],
      [halfWidth, -halfHeight],
    ],
    right: [
      [halfWidth, -halfHeight],
      [halfWidth, halfHeight],
    ],
    top: [
      [halfWidth, halfHeight],
      [-halfWidth, halfHeight],
    ],
    left: [
      [-halfWidth, halfHeight],
      [-halfWidth, -halfHeight],
    ],
  };
  return endpoints[side];
}
