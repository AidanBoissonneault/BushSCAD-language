/**
 * @author Aidan Boissonneault
 * @file frame-utils.ts
 * @purpose Provides frame utils behavior for the topology in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

import type { IRPrimitive, Workplane } from '@bushscad/ir';
import {
  arcCenterCandidates,
  findPlantLineSegment,
  profileVectorToRevolveLocal,
  revolvePlantLineLocalNormal,
} from '@bushscad/ir';
import type { FaceFrame } from './face-labels.js';
import type { Vec3 } from '../core/geometry-utils.js';
import type { OC } from '../bridge/bridge-types.js';

export { isOpenProfile } from '../profiles/profile-open.js';

/**
 * Ax2 axes, including point, x, y, and z.
 */
type Ax2Axes = {
  point: Vec3;
  x: Vec3;
  y: Vec3;
  z: Vec3;
};

const WORKPLANE_FRAMES: Record<Workplane, FaceFrame> = {
  XY: {
    x: [1, 0, 0],
    y: [0, 1, 0],
    z: [0, 0, 1],
  },
  XZ: {
    x: [1, 0, 0],
    y: [0, 0, 1],
    z: [0, -1, 0],
  },
  YZ: {
    x: [0, 1, 0],
    y: [0, 0, 1],
    z: [1, 0, 0],
  },
};

/**
 * Handles workplane frame in the topology flow.
 */
export function workplaneFrame(workplane: Workplane): FaceFrame {
  return WORKPLANE_FRAMES[workplane];
}

/**
 * Handles cardinal axis in the topology flow.
 */
export function cardinalAxis(axis: 'x' | 'y' | 'z'): Vec3 {
  switch (axis) {
    case 'x':
      return [1, 0, 0];
    case 'y':
      return [0, 1, 0];
    case 'z':
      return [0, 0, 1];
  }
}

/**
 * Builds the axis data required by the current operation.
 */
export function axisPointAndDirection(ax2: unknown): {
  point: Vec3;
  dir: Vec3;
} {
  const axis = ax2 as Record<string, () => unknown>;
  const loc = axis.Location() as Record<string, () => number>;
  const dir = axis.Direction() as Record<string, () => number>;
  const result = {
    point: [loc.X(), loc.Y(), loc.Z()] as Vec3,
    dir: normalizeVec([dir.X(), dir.Y(), dir.Z()]) ?? ([0, 0, 1] as Vec3),
  };
  (loc as unknown as { delete(): void }).delete();
  (dir as unknown as { delete?(): void }).delete?.();
  (ax2 as { delete(): void }).delete();
  return result;
}

/**
 * Builds the axis data required by the current operation.
 */
export function ax2Axes(ax2: unknown): Ax2Axes {
  const axis = ax2 as Record<string, () => unknown>;
  const loc = axis.Location() as Record<string, () => number>;
  const xDir = axis.XDirection() as Record<string, () => number>;
  const zDir = axis.Direction() as Record<string, () => number>;
  const rawX =
    normalizeVec([xDir.X(), xDir.Y(), xDir.Z()]) ?? ([1, 0, 0] as Vec3);
  const rawZ =
    normalizeVec([zDir.X(), zDir.Y(), zDir.Z()]) ?? ([0, 0, 1] as Vec3);
  const yDir =
    typeof axis.YDirection === 'function'
      ? (axis.YDirection() as Record<string, () => number>)
      : null;
  const rawY =
    yDir !== null
      ? normalizeVec([yDir.X(), yDir.Y(), yDir.Z()])
      : normalizeVec(crossVec(rawZ, rawX));
  const result = {
    point: [loc.X(), loc.Y(), loc.Z()] as Vec3,
    x: rawX,
    y: rawY ?? ([0, 1, 0] as Vec3),
    z: rawZ,
  };
  (loc as unknown as { delete(): void }).delete();
  (xDir as unknown as { delete?(): void }).delete?.();
  (zDir as unknown as { delete?(): void }).delete?.();
  (yDir as unknown as { delete?(): void } | null)?.delete?.();
  return result;
}

/**
 * Builds the axis data required by the current operation.
 */
export function axisPointAndLocalDirection(
  ax2: unknown,
  axis: 'x' | 'y' | 'z',
): { point: Vec3; dir: Vec3 } {
  const axes = ax2Axes(ax2);
  return {
    point: axes.point,
    dir: axis === 'x' ? axes.x : axis === 'y' ? axes.y : axes.z,
  };
}

/**
 * Builds the axis data required by the current operation.
 */
export function axisDirection(ax2: unknown): Vec3 {
  const axis = ax2 as Record<string, () => unknown>;
  const dir = axis.Direction() as Record<string, () => number>;
  const result =
    normalizeVec([dir.X(), dir.Y(), dir.Z()]) ?? ([0, 0, 1] as Vec3);
  (dir as unknown as { delete?(): void }).delete?.();
  return result;
}

/**
 * Handles revolve plant local normal in the topology flow.
 */
export function revolvePlantLocalNormal(
  prim: IRPrimitive,
  axis: 'x' | 'y' | 'z',
): Vec3 | null {
  if (prim.kind === 'polygon') {
    return prim.plant ? profileVectorToRevolveLocal(axis, 0, -1) : null;
  }
  const segment = findPlantLineSegment(prim);
  if (!segment) return null;
  return revolvePlantLineLocalNormal(segment.from, segment.to, axis);
}

/**
 * Creates a local vector to world value for the current operation.
 */
export function localVectorToWorld(vector: Vec3, axes: Ax2Axes): Vec3 {
  return [
    axes.x[0] * vector[0] + axes.y[0] * vector[1] + axes.z[0] * vector[2],
    axes.x[1] * vector[0] + axes.y[1] * vector[1] + axes.z[1] * vector[2],
    axes.x[2] * vector[0] + axes.y[2] * vector[1] + axes.z[2] * vector[2],
  ];
}

/**
 * Handles frame from plant normal in the topology flow.
 */
export function frameFromPlantNormal(
  plantNormal: Vec3,
  axes: Ax2Axes,
): FaceFrame {
  const z =
    normalizeVec([-plantNormal[0], -plantNormal[1], -plantNormal[2]]) ?? axes.z;
  const x =
    projectPerpendicular(axes.x, z) ??
    projectPerpendicular(axes.y, z) ??
    projectPerpendicular(axes.z, z) ??
    ([1, 0, 0] as Vec3);
  const y = normalizeVec(crossVec(z, x)) ?? axes.y;
  return { x, y, z };
}

/**
 * Handles project perpendicular in the topology flow.
 */
export function projectPerpendicular(vector: Vec3, normal: Vec3): Vec3 | null {
  const d = dotVec(vector, normal);
  return normalizeVec([
    vector[0] - normal[0] * d,
    vector[1] - normal[1] * d,
    vector[2] - normal[2] * d,
  ]);
}

/**
 * Handles radius arc center in the topology flow.
 */
export function radiusArcCenter(
  from: [number, number],
  to: [number, number],
  radius: number,
  clockwise: boolean,
): [number, number] {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const chord = Math.hypot(dx, dy);
  if (chord <= 1e-9) return [from[0], from[1]];
  const candidates = arcCenterCandidates(from, to, radius) ?? [from];
  return (
    candidates.find((center) => {
      const a0 = Math.atan2(from[1] - center[1], from[0] - center[0]);
      const a1 = Math.atan2(to[1] - center[1], to[0] - center[0]);
      const ccwSweep = (a1 - a0 + Math.PI * 2) % (Math.PI * 2);
      const cwSweep = (a0 - a1 + Math.PI * 2) % (Math.PI * 2);
      return clockwise ? cwSweep <= Math.PI : ccwSweep <= Math.PI;
    }) ?? candidates[0]
  );
}

/**
 * Rotates frame around the requested axis.
 */
export function rotateFrame(
  frame: FaceFrame,
  axis: Vec3,
  angleDeg: number,
): FaceFrame {
  const unitAxis = normalizeVec(axis) ?? ([0, 0, 1] as Vec3);
  return {
    x: rotateVector(frame.x, unitAxis, angleDeg),
    y: rotateVector(frame.y, unitAxis, angleDeg),
    z: rotateVector(frame.z, unitAxis, angleDeg),
  };
}

/**
 * Rotates vector around the requested axis.
 */
function rotateVector(vector: Vec3, axis: Vec3, angleDeg: number): Vec3 {
  const angle = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const cross = crossVec(axis, vector);
  const dot = dotVec(axis, vector);
  return (
    normalizeVec([
      vector[0] * cos + cross[0] * sin + axis[0] * dot * (1 - cos),
      vector[1] * cos + cross[1] * sin + axis[1] * dot * (1 - cos),
      vector[2] * cos + cross[2] * sin + axis[2] * dot * (1 - cos),
    ]) ?? vector
  );
}

/**
 * Returns the dot product of the supplied vectors.
 */
export function dotVec(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

/**
 * Returns the cross product of the supplied vectors.
 */
export function crossVec(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

/**
 * Handles safe face normal in the topology flow.
 */
export function safeFaceNormal(
  oc: OC,
  face: unknown,
  fallback: [number, number, number],
): [number, number, number] {
  let nProps: OC | null = null;
  let pnt: OC | null = null;
  let nVec: OC | null = null;
  try {
    nProps = new oc.BRepGProp_Face_2(face, false);
    const uMin = { current: 0 },
      uMax = { current: 0 };
    const vMin = { current: 0 },
      vMax = { current: 0 };
    nProps.Bounds(uMin, uMax, vMin, vMax);
    pnt = new oc.gp_Pnt_1();
    nVec = new oc.gp_Vec_1();
    nProps.Normal(
      (uMin.current + uMax.current) / 2,
      (vMin.current + vMax.current) / 2,
      pnt,
      nVec,
    );
    return normalizeVec([nVec.X(), nVec.Y(), nVec.Z()]) ?? fallback;
  } catch {
    return fallback;
  } finally {
    pnt?.delete();
    nVec?.delete();
    nProps?.delete();
  }
}

/**
 * Handles normal from triangles in the topology flow.
 */
export function normalFromTriangles(
  vertices: number[],
  triangles: [number, number, number][],
): [number, number, number] | null {
  for (const [ai, bi, ci] of triangles) {
    const ax = vertices[ai * 3],
      ay = vertices[ai * 3 + 1],
      az = vertices[ai * 3 + 2];
    const bx = vertices[bi * 3],
      by = vertices[bi * 3 + 1],
      bz = vertices[bi * 3 + 2];
    const cx = vertices[ci * 3],
      cy = vertices[ci * 3 + 1],
      cz = vertices[ci * 3 + 2];
    const ux = bx - ax,
      uy = by - ay,
      uz = bz - az;
    const vx = cx - ax,
      vy = cy - ay,
      vz = cz - az;
    const normal = normalizeVec([
      uy * vz - uz * vy,
      uz * vx - ux * vz,
      ux * vy - uy * vx,
    ]);
    if (normal) return normal;
  }
  return null;
}

/**
 * Normalizes vec into the canonical form.
 */
export function normalizeVec(
  v: [number, number, number],
): [number, number, number] | null {
  const [x, y, z] = v;
  const len = Math.sqrt(x * x + y * y + z * z);
  if (!Number.isFinite(len) || len <= 1e-12) return null;
  return [x / len, y / len, z / len];
}
