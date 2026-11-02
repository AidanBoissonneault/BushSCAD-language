/**
 * @author Aidan Boissonneault
 * @file xy-circle.ts
 * @purpose Provides xy circle behavior for the profiles in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

import type { OC } from '../bridge/bridge-types.js';

/**
 * Xy circle handles, including origin, z dir, x dir, ax2, and circ.
 */
type XYCircleHandles = {
  origin: OC;
  zDir: OC;
  xDir: OC;
  ax2: OC;
  circ: OC;
};

/**
 * Creates OpenCascade handles for a circle in the local XY plane.
 * Profile, primitive, and arc-edge builders all need identical gp_Circ setup;
 * centralizing it prevents subtle axis mismatches.
 */
export function makeXYCircleHandles(
  oc: OC,
  cx: number,
  cy: number,
  radius: number,
): XYCircleHandles {
  const origin = new oc.gp_Pnt_3(cx, cy, 0);
  const zDir = new oc.gp_Dir_4(0, 0, 1);
  const xDir = new oc.gp_Dir_4(1, 0, 0);
  const ax2 = new oc.gp_Ax2_2(origin, zDir, xDir);
  const circ = new oc.gp_Circ_2(ax2, radius);
  return { origin, zDir, xDir, ax2, circ };
}
