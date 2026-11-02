/**
 * @author Aidan Boissonneault
 * @file additive-overlap.ts
 * @purpose Provides additive overlap behavior for the operations in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

import type { SourceSpan } from '@bushscad/ir';
import type { OC } from '../bridge/bridge-types.js';

const MIN_OVERLAP_MM = 1e-4;
const MAX_OVERLAP_MM = 0.01;

/**
 * Input for overlapped extrude, including face, depth, and overlapped.
 */
type OverlappedExtrudeInput = {
  face: OC;
  depth: number;
  overlapped: true;
};

/**
 * Moves an additive face slightly into the target before part-level fusion.
 * OCCT booleans are slow and fragile when two solids only touch on a
 * coplanar face or share an edge. A tiny internal overlap removes the
 * tangent-only case while preserving the visible extrusion end plane.
 */
export function makePartFuseOverlapExtrudeInput(
  oc: OC,
  placedFace: OC,
  ax2: OC,
  depth: number,
  span: SourceSpan,
): OverlappedExtrudeInput {
  const sign = depth < 0 ? -1 : 1;
  const overlap = overlapForDepth(depth);
  const dir = ax2.Direction();
  const dx = -sign * dir.X() * overlap;
  const dy = -sign * dir.Y() * overlap;
  const dz = -sign * dir.Z() * overlap;
  dir.delete?.();

  return {
    face: translateShape(oc, placedFace, dx, dy, dz, span),
    depth: depth + sign * overlap,
    overlapped: true,
  };
}

/**
 * Handles overlap for depth in the operations flow.
 */
function overlapForDepth(depth: number): number {
  const scaled = Math.abs(depth) * 1e-4;
  return Math.min(MAX_OVERLAP_MM, Math.max(MIN_OVERLAP_MM, scaled));
}

/**
 * Translates shape by the supplied offset.
 */
function translateShape(
  oc: OC,
  shape: OC,
  dx: number,
  dy: number,
  dz: number,
  _span: SourceSpan,
): OC {
  const trsf = new oc.gp_Trsf_1();
  const vec = new oc.gp_Vec_4(dx, dy, dz);
  trsf.SetTranslation_1(vec);
  const moved = new oc.BRepBuilderAPI_Transform_2(shape, trsf, false).Shape();
  shape.delete?.();
  trsf.delete?.();
  vec.delete?.();
  return moved;
}
