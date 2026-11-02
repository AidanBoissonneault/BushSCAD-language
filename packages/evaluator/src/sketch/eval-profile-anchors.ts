/**
 * @author Aidan Boissonneault
 * @file eval-profile-anchors.ts
 * @purpose Evaluates profile anchors for the sketch in evaluator package.
 * @last-edited October 6, 2026
 */

import type { IRPrimitive } from '@bushscad/ir';
import { findPlantLineSegment, normalize2 } from '@bushscad/ir';
import type { AnchorFaceDir, EvalCtx } from '../core/eval-types.js';

/**
 * Registers the default source anchor for a flat extruded profile.
 * Placement needs a stable source reference even when the author omits an
 * explicit source anchor. A planted side takes precedence; otherwise a path
 * placement origin supplies the flat sketch anchor.
 */
export function registerExtrudeProfileAnchor(
  ctx: EvalCtx,
  objName: string,
  prim: IRPrimitive,
): void {
  const segment = findPlantLineSegment(prim);
  if (!segment) {
    registerPlacementOriginAnchor(ctx, objName, prim);
    return;
  }
  const [nx, ny] = normalize2(
    segment.to[1] - segment.from[1],
    segment.from[0] - segment.to[0],
  );
  const face = extrudeSideFaceFromLocalNormal(nx, ny);
  ctx.plantAnchors.set(objName, {
    ref: `${objName}.${face}.center`,
    faceName: segment.name,
    localPoint: [
      (segment.from[0] + segment.to[0]) / 2,
      (segment.from[1] + segment.to[1]) / 2,
      0,
    ],
    localNormal: [nx, ny, 0],
  });
}

/**
 * Registers a path placement origin as a flat sketch source anchor.
 * `origin((x, y))` is placement metadata, not geometry. Keeping it in the
 * plant-anchor map lets existing place/extrude/cut source-anchor resolution
 * reuse the same path as planted sides.
 */
function registerPlacementOriginAnchor(
  ctx: EvalCtx,
  objName: string,
  prim: IRPrimitive,
): void {
  if (prim.kind !== 'profile' || !prim.placementOrigin) return;
  ctx.plantAnchors.set(objName, {
    ref: `${objName}.bottom.center`,
    localPoint: [prim.placementOrigin[0], prim.placementOrigin[1], 0],
    localNormal: [0, 0, -1],
  });
}

/**
 * Maps a planted profile-line normal to the generated extrude side face.
 * Path segment names are author labels, while placement needs the actual CAD
 * side face produced from the planted edge's outward local normal.
 */
function extrudeSideFaceFromLocalNormal(
  nx: number,
  ny: number,
): Exclude<AnchorFaceDir, 'top' | 'bottom'> {
  if (Math.abs(nx) >= Math.abs(ny)) return nx >= 0 ? 'right' : 'left';
  return ny >= 0 ? 'back' : 'front';
}
