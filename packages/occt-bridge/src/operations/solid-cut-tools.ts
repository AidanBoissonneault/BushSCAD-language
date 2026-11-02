/**
 * @author Aidan Boissonneault
 * @file solid-cut-tools.ts
 * @purpose Provides solid cut tools behavior for the operations in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

import type { OC } from '../bridge/bridge-types.js';
import { ax2Axes } from '../topology/frame-utils.js';
import type { Vec3 } from '../core/geometry-utils.js';

/**
 * Solid cut tool source, including shape, source ax2, copy, delete source, and tool kind.
 */
export type SolidCutToolSource = {
  shape: OC;
  sourceAx2: OC;
  copy: boolean;
  deleteSource: boolean;
  toolKind?: string;
};

/**
 * Builds an OCCT axis from explicit vectors.
 * Solid-cut placement needs to preserve a tool-local frame while sometimes
 * flipping or rotating one axis for cut direction and revolve profile layout.
 */
export function makeAxisFromVectors(oc: OC, point: Vec3, z: Vec3, x: Vec3): OC {
  const origin = new oc.gp_Pnt_3(point[0], point[1], point[2]);
  const zDir = new oc.gp_Dir_4(z[0], z[1], z[2]);
  const xDir = new oc.gp_Dir_4(x[0], x[1], x[2]);
  const ax2 = new oc.gp_Ax2_2(origin, zDir, xDir);
  [origin, zDir, xDir].forEach((o: OC) => o.delete?.());
  return ax2;
}

/**
 * Transforms a solid tool from its authored frame to the target cut frame.
 * Predefined tools must be copied from their declaration frame while inline
 * tools are moved from their temporary source frame before subtraction.
 */
export function transformShapeBetweenAxes(
  oc: OC,
  shape: OC,
  sourceAx2: OC,
  targetAx2: OC,
  copy: boolean,
): OC {
  const fromAx3 = new oc.gp_Ax3_2(sourceAx2);
  const toAx3 = new oc.gp_Ax3_2(targetAx2);
  const trsf = new oc.gp_Trsf_1();
  trsf.SetDisplacement(fromAx3, toAx3);
  const moved = new oc.BRepBuilderAPI_Transform_2(shape, trsf, copy).Shape();
  [fromAx3, toAx3, trsf].forEach((o: OC) => o.delete?.());
  return moved;
}

/**
 * Returns the sketch placement axis used to author an inline revolve tool.
 * Regular revolve bodies place the sketch face in its sketch plane. For solid
 * cut tools, `around z` means the cutter's local Z is the revolve/cut axis, so
 * the 2D profile must be placed in a radial/axial plane containing that axis.
 */
export function inlineRevolveToolProfileAxis(oc: OC, sourceAx2: OC): OC {
  const axes = ax2Axes(sourceAx2);
  return makeAxisFromVectors(
    oc,
    axes.point,
    [-axes.y[0], -axes.y[1], -axes.y[2]],
    axes.x,
  );
}
