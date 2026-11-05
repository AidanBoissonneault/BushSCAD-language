/** Owns placement transforms for face axes for the OCCT topology layer. */
import { type AxisBaseResolution, type FaceFrame } from '../types.js';
import type { IRPlacement } from '@bushscad/ir';
import type { FaceDir, ParsedFaceRef } from '../../../core/program-utils.js';
import { type Vec3 } from '../../../core/geometry-utils.js';
import {
  applyPlacementAnchor,
  dirToOffsetAxes,
  placementOffsetAxes,
  rotateAxisAroundLocalAxes,
  rotateAxisAroundNormal,
  toWorldVector,
  translateAxisAlongNormal,
} from '../../face-placement-transform.js';
import type { OC } from '../../face-placement-transform.js';

/**
 * Applies planar placement offset to the supplied state or geometry.
 */
export function applyPlanarPlacementOffset(
  oc: OC,
  base: AxisBaseResolution,
  placement: IRPlacement,
): unknown {
  const { entry, faceDir, parsed } = base;
  const frame = entry?.frame ?? base.frame;
  if (!frame || !faceDir) return base.ax2;
  const { dx, dy } = planarPlacementOffset(placement);
  return dx !== 0 || dy !== 0
    ? translateAxis(
        oc,
        base.ax2,
        faceDir,
        parsed,
        dx,
        dy,
        frame,
        base.frame !== undefined,
      )
    : base.ax2;
}

/**
 * Handles planar placement offset in the topology flow.
 */
function planarPlacementOffset(placement: IRPlacement): {
  dx: number;
  dy: number;
} {
  let dx = placement.offsetX ?? 0;
  let dy = placement.offsetY ?? 0;
  const radius = placement.radius ?? 0;
  if (radius !== 0) {
    const angleRad = ((placement.angleDeg ?? 0) * Math.PI) / 180;
    dx += radius * Math.cos(angleRad);
    dy += radius * Math.sin(angleRad);
  }
  return { dx, dy };
}

/**
 * Applies normal placement offset to the supplied state or geometry.
 */
export function applyNormalPlacementOffset(
  oc: OC,
  ax2: unknown,
  placement: IRPlacement,
): unknown {
  return placement.offsetZ
    ? translateAxisAlongNormal(oc, ax2, placement.offsetZ)
    : ax2;
}

/**
 * Applies normal placement rotation to the supplied state or geometry.
 */
export function applyNormalPlacementRotation(
  oc: OC,
  ax2: unknown,
  placement: IRPlacement,
): unknown {
  return placement.rotationDeg
    ? rotateAxisAroundNormal(oc, ax2, placement.rotationDeg)
    : ax2;
}

/**
 * Applies local axis placement rotation to the supplied state or geometry.
 */
export function applyLocalAxisPlacementRotation(
  oc: OC,
  ax2: unknown,
  placement: IRPlacement,
): unknown {
  return placement.axisRotationDeg
    ? rotateAxisAroundLocalAxes(oc, ax2, placement.axisRotationDeg)
    : ax2;
}

/**
 * Applies placement anchor transform to the supplied state or geometry.
 */
export function applyPlacementAnchorTransform(
  oc: OC,
  ax2: unknown,
  placement: IRPlacement,
): unknown {
  return placement.anchor
    ? applyPlacementAnchor(oc, ax2, placement.anchor)
    : ax2;
}

/**
 * Translates axis by the supplied offset.
 */
function translateAxis(
  oc: OC,
  ax2: unknown,
  dir: FaceDir,
  ref: ParsedFaceRef,
  dx: number,
  dy: number,
  frame: FaceFrame,
  useWorkplaneAxes: boolean,
): unknown /* gp_Ax2 */ {
  const a = ax2 as Record<string, () => unknown>;
  const loc = a.Location() as Record<string, () => number>;
  const axes = useWorkplaneAxes
    ? dirToOffsetAxes(dir)
    : placementOffsetAxes(dir, ref);
  const [[ux, uy, uz], [vx, vy, vz]] = axes.map(
    (axis) => toWorldVector(axis, frame),
  ) as [Vec3, Vec3];
  const zd = a.Direction() as unknown;

  const x = loc.X() + ux * dx + vx * dy;
  const y = loc.Y() + uy * dx + vy * dy;
  const z = loc.Z() + uz * dx + vz * dy;

  const newLoc = new oc.gp_Pnt_3(x, y, z);
  const newAx2 = new oc.gp_Ax2_2(newLoc, zd, a.XDirection());
  (loc as unknown as { delete(): void }).delete();
  (newLoc as { delete(): void }).delete();
  (ax2 as { delete(): void }).delete();
  return newAx2;
}
