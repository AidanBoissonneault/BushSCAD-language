/**
 * @author Aidan Boissonneault
 * @file thread-axis.ts
 * @purpose Provides thread axis behavior for the threads in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

import type { IRThread } from '@bushscad/ir';
import type { FaceFrame } from '../topology/face-labels.js';
import type { GroupBuildState, OC } from '../bridge/bridge-types.js';
import { readBounds, type Vec3 } from '../core/geometry-utils.js';
import { ax2Axes, crossVec, normalizeVec } from '../topology/frame-utils.js';

/**
 * Type used for bounds.
 */
type Bounds = ReturnType<typeof readBounds>;

/**
 * Thread axis, including top, center, axis, x, and y.
 */
export type ThreadAxis = {
  top: Vec3;
  center: Vec3;
  axis: Vec3;
  x: Vec3;
  y: Vec3;
  extent: number;
};

/**
 * Resolves where a thread starts, which way it cuts, and how far it extends.
 * Internal threads need the original cut placement, while external threads can
 * infer their axis from the owning body's frame and bounds.
 */
export function resolveThreadAxis(
  oc: OC,
  state: GroupBuildState,
  op: IRThread,
  bodyShape: OC,
  bounds: Bounds,
  frame: FaceFrame,
): ThreadAxis {
  if (op.axis) {
    const ax2 = state.labelMap.resolveAxis(oc, op.axis) as OC;
    try {
      const axes = ax2Axes(ax2);
      const axis = threadDirectionAwayFromBody(oc, ax2, bodyShape, axes.z);
      const top = axisLocation(ax2);
      return {
        top,
        center: boundsCenter(bounds),
        axis,
        x: axes.x,
        y: normalizeVec(crossVec(axis, axes.x)) ?? axes.y,
        extent:
          op.axialExtentMm ?? axisDistanceThroughBounds(top, axis, bounds),
      };
    } finally {
      ax2.delete?.();
    }
  }

  const center = boundsCenter(bounds);
  const axis = normalizeVec(frame.z) ?? ([0, 0, 1] as Vec3);
  const x = normalizeVec(frame.x) ?? ([1, 0, 0] as Vec3);
  return {
    top: boundsExtremePoint(center, axis, bounds),
    center,
    axis,
    x,
    y: normalizeVec(crossVec(axis, x)) ?? ([0, 1, 0] as Vec3),
    extent: op.axialExtentMm ?? axisDistanceThroughBounds(center, axis, bounds),
  };
}

/**
 * Handles thread direction away from body in the threads flow.
 */
function threadDirectionAwayFromBody(
  oc: OC,
  ax2: OC,
  bodyShape: OC,
  axis: Vec3,
): Vec3 {
  const loc = axisLocation(ax2);
  const center = boundsCenter(readBounds(oc, bodyShape));
  const toCenter =
    axis[0] * (center[0] - loc[0]) +
    axis[1] * (center[1] - loc[1]) +
    axis[2] * (center[2] - loc[2]);
  const dir = toCenter <= 0 ? axis : ([-axis[0], -axis[1], -axis[2]] as Vec3);
  return normalizeVec(dir) ?? ([0, 0, 1] as Vec3);
}

/**
 * Builds the axis data required by the current operation.
 */
function axisLocation(ax2: OC): Vec3 {
  const loc = (ax2 as Record<string, () => OC>).Location();
  const result: Vec3 = [loc.X(), loc.Y(), loc.Z()];
  loc.delete?.();
  return result;
}

/**
 * Calculates the bounds of the supplied geometry.
 */
function boundsCenter(bounds: Bounds): Vec3 {
  return [
    (bounds.xMin.current + bounds.xMax.current) / 2,
    (bounds.yMin.current + bounds.yMax.current) / 2,
    (bounds.zMin.current + bounds.zMax.current) / 2,
  ];
}

/**
 * Calculates the bounds of the supplied geometry.
 */
function boundsExtremePoint(center: Vec3, axis: Vec3, bounds: Bounds): Vec3 {
  const maxProj =
    (axis[0] >= 0 ? bounds.xMax.current : bounds.xMin.current) * axis[0] +
    (axis[1] >= 0 ? bounds.yMax.current : bounds.yMin.current) * axis[1] +
    (axis[2] >= 0 ? bounds.zMax.current : bounds.zMin.current) * axis[2];
  const centerProj =
    center[0] * axis[0] + center[1] * axis[1] + center[2] * axis[2];
  const dist = maxProj - centerProj;
  return [
    center[0] + dist * axis[0],
    center[1] + dist * axis[1],
    center[2] + dist * axis[2],
  ];
}

/**
 * Builds the axis data required by the current operation.
 */
function axisDistanceThroughBounds(
  origin: Vec3,
  axis: Vec3,
  bounds: Bounds,
): number {
  const corners: Vec3[] = [
    [bounds.xMin.current, bounds.yMin.current, bounds.zMin.current],
    [bounds.xMin.current, bounds.yMin.current, bounds.zMax.current],
    [bounds.xMin.current, bounds.yMax.current, bounds.zMin.current],
    [bounds.xMin.current, bounds.yMax.current, bounds.zMax.current],
    [bounds.xMax.current, bounds.yMin.current, bounds.zMin.current],
    [bounds.xMax.current, bounds.yMin.current, bounds.zMax.current],
    [bounds.xMax.current, bounds.yMax.current, bounds.zMin.current],
    [bounds.xMax.current, bounds.yMax.current, bounds.zMax.current],
  ];
  return Math.max(
    ...corners.map((corner) =>
      Math.abs(
        (corner[0] - origin[0]) * axis[0] +
          (corner[1] - origin[1]) * axis[1] +
          (corner[2] - origin[2]) * axis[2],
      ),
    ),
  );
}
