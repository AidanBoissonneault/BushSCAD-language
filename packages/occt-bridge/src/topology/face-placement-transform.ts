/**
 * @author Aidan Boissonneault
 * @file face-placement-transform.ts
 * @purpose Provides face placement transform behavior for the topology in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

import type { FaceDir, ParsedFaceRef } from '../core/program-utils.js';
import type { Vec3 } from '../core/geometry-utils.js';
import { crossVec as cross, normalizeVec } from './frame-utils.js';
import type { FaceFrame } from './face-labels.js';
import type { IRPlacement } from '@bushscad/ir';

/**
 * Alias for the dynamically loaded OpenCascade bindings, whose generated wrapper API is not
 * fully described by static declarations.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type OC = any;

export const WORLD_FRAME: FaceFrame = {
  x: [1, 0, 0],
  y: [0, 1, 0],
  z: [0, 0, 1],
};

/**
 * Resolves the face data required by the current selector.
 */
export function faceFrameFromAx2(ax2: unknown): FaceFrame {
  const axis = ax2 as Record<string, () => unknown>;
  const x = readAxisDir(axis, 'XDirection', WORLD_FRAME.x);
  const z = readAxisDir(axis, 'Direction', WORLD_FRAME.z);
  const y = readAxisDir(
    axis,
    'YDirection',
    normalizeVec(cross(z, x)) ?? WORLD_FRAME.y,
  );
  return {
    x: normalizeVec(x) ?? WORLD_FRAME.x,
    y: normalizeVec(y) ?? WORLD_FRAME.y,
    z: normalizeVec(z) ?? WORLD_FRAME.z,
  };
}

/**
 * Reads axis dir from the supplied source.
 */
function readAxisDir(
  axis: Record<string, () => unknown>,
  method: string,
  fallback: Vec3,
): Vec3 {
  try {
    const dir = axis[method]?.() as
      | {
          X?: () => number;
          Y?: () => number;
          Z?: () => number;
          delete?: () => void;
        }
      | undefined;
    if (
      !dir ||
      typeof dir.X !== 'function' ||
      typeof dir.Y !== 'function' ||
      typeof dir.Z !== 'function'
    ) {
      return fallback;
    }
    const result: Vec3 = [dir.X(), dir.Y(), dir.Z()];
    dir.delete?.();
    return result;
  } catch {
    return fallback;
  }
}

/**
 * Returns the dot product of the supplied vectors.
 */
export function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

/**
 * Converts the supplied value to its local point representation.
 */
export function toLocalPoint(point: Vec3, frame: FaceFrame): Vec3 {
  return toLocalVector(point, frame);
}

/**
 * Converts the supplied value to its local vector representation.
 */
export function toLocalVector(vector: Vec3, frame: FaceFrame): Vec3 {
  return [dot(vector, frame.x), dot(vector, frame.y), dot(vector, frame.z)];
}

/**
 * Converts the supplied value to its world vector representation.
 */
export function toWorldVector(vector: Vec3, frame: FaceFrame): Vec3 {
  return [
    frame.x[0] * vector[0] + frame.y[0] * vector[1] + frame.z[0] * vector[2],
    frame.x[1] * vector[0] + frame.y[1] * vector[1] + frame.z[1] * vector[2],
    frame.x[2] * vector[0] + frame.y[2] * vector[1] + frame.z[2] * vector[2],
  ];
}

/**
 * Constructs point from local from the supplied values.
 */
export function makePointFromLocal(
  oc: OC,
  local: Vec3,
  frame: FaceFrame,
): unknown {
  const [x, y, z] = toWorldVector(local, frame);
  return new oc.gp_Pnt_3(x, y, z);
}

/**
 * Translates axis along normal by the supplied offset.
 */
export function translateAxisAlongNormal(
  oc: OC,
  ax2: unknown,
  dist: number,
): unknown /* gp_Ax2 */ {
  const a = ax2 as Record<string, () => unknown>;
  const loc = a.Location() as Record<string, () => number>;
  const normal = a.Direction() as Record<string, () => number>;
  const [nx, ny, nz] = [normal.X(), normal.Y(), normal.Z()];
  const newLoc = new oc.gp_Pnt_3(
    loc.X() + nx * dist,
    loc.Y() + ny * dist,
    loc.Z() + nz * dist,
  );
  const newAx2 = new oc.gp_Ax2_2(newLoc, a.Direction(), a.XDirection());
  (loc as unknown as { delete(): void }).delete();
  (normal as unknown as { delete?(): void }).delete?.();
  (newLoc as { delete(): void }).delete();
  (ax2 as { delete(): void }).delete();
  return newAx2;
}

/**
 * Reads an OCCT gp_Ax2 into plain location coordinates and z/x/y basis vectors,
 * releasing the transient OCCT accessor objects it allocates.
 */
function readAx2Basis(ax2: unknown): {
  location: Vec3;
  z: Vec3;
  x: Vec3;
  y: Vec3;
} {
  const axis = ax2 as Record<string, () => unknown>;
  const loc = axis.Location() as Record<string, () => number>;
  const normal = axis.Direction() as Record<string, () => number>;
  const xDir = axis.XDirection() as Record<string, () => number>;
  const location: Vec3 = [loc.X(), loc.Y(), loc.Z()];
  const z: Vec3 = [normal.X(), normal.Y(), normal.Z()];
  const x: Vec3 = [xDir.X(), xDir.Y(), xDir.Z()];
  const y = normalizeVec(cross(z, x)) ?? WORLD_FRAME.y;
  (loc as unknown as { delete(): void }).delete();
  (normal as unknown as { delete?(): void }).delete?.();
  (xDir as unknown as { delete?(): void }).delete?.();
  return { location, z, x, y };
}

/**
 * Builds a fresh OCCT gp_Ax2 from plain vectors, releasing the transient
 * direction/point objects and the supplied old axis.
 */
function buildAx2(
  oc: OC,
  location: Vec3,
  z: Vec3,
  x: Vec3,
  oldAx2: unknown,
): unknown /* gp_Ax2 */ {
  const newLoc = new oc.gp_Pnt_3(location[0], location[1], location[2]);
  const newZ = new oc.gp_Dir_4(z[0], z[1], z[2]);
  const newX = new oc.gp_Dir_4(x[0], x[1], x[2]);
  const newAx2 = new oc.gp_Ax2_2(newLoc, newZ, newX);
  newLoc.delete();
  newZ.delete();
  newX.delete();
  (oldAx2 as { delete(): void }).delete();
  return newAx2;
}

/**
 * Rotates axis around normal around the requested axis.
 */
export function rotateAxisAroundNormal(
  oc: OC,
  ax2: unknown,
  angleDeg: number,
): unknown /* gp_Ax2 */ {
  const { location, z, x, y } = readAx2Basis(ax2);
  const angle = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const rotatedX =
    normalizeVec([
      x[0] * cos + y[0] * sin,
      x[1] * cos + y[1] * sin,
      x[2] * cos + y[2] * sin,
    ]) ?? x;
  return buildAx2(oc, location, z, rotatedX, ax2);
}

/**
 * Rotates axis around local axes around the requested axis.
 */
export function rotateAxisAroundLocalAxes(
  oc: OC,
  ax2: unknown,
  rotation: NonNullable<IRPlacement['axisRotationDeg']>,
): unknown /* gp_Ax2 */ {
  let next = ax2;
  if (rotation.x) next = rotateAxisAroundLocalAxis(oc, next, 'x', rotation.x);
  if (rotation.y) next = rotateAxisAroundLocalAxis(oc, next, 'y', rotation.y);
  if (rotation.z) next = rotateAxisAroundLocalAxis(oc, next, 'z', rotation.z);
  return next;
}

/**
 * Rotates axis around local axis around the requested axis.
 */
function rotateAxisAroundLocalAxis(
  oc: OC,
  ax2: unknown,
  localAxis: 'x' | 'y' | 'z',
  angleDeg: number,
): unknown /* gp_Ax2 */ {
  const { location, z, x, y } = readAx2Basis(ax2);
  const around = localAxis === 'x' ? x : localAxis === 'y' ? y : z;
  const newZ = rotateVec(z, around, angleDeg);
  const newX = rotateVec(x, around, angleDeg);
  return buildAx2(oc, location, newZ, newX, ax2);
}

/**
 * Rotates vec around the requested axis.
 */
function rotateVec(vector: Vec3, axis: Vec3, angleDeg: number): Vec3 {
  const unit = normalizeVec(axis) ?? WORLD_FRAME.z;
  const angle = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const axisCrossVector = cross(unit, vector);
  const axisDotVector = dot(unit, vector);
  return (
    normalizeVec([
      vector[0] * cos +
        axisCrossVector[0] * sin +
        unit[0] * axisDotVector * (1 - cos),
      vector[1] * cos +
        axisCrossVector[1] * sin +
        unit[1] * axisDotVector * (1 - cos),
      vector[2] * cos +
        axisCrossVector[2] * sin +
        unit[2] * axisDotVector * (1 - cos),
    ]) ?? vector
  );
}

/**
 * Applies placement anchor to the supplied state or geometry.
 */
export function applyPlacementAnchor(
  oc: OC,
  ax2: unknown,
  anchor: NonNullable<IRPlacement['anchor']>,
): unknown /* gp_Ax2 */ {
  const { location, z: rawZ, x: rawX } = readAx2Basis(ax2);

  const baseZ = normalizeVec(rawZ) ?? WORLD_FRAME.z;
  const baseX = normalizeVec(rawX) ?? WORLD_FRAME.x;
  const baseY = normalizeVec(cross(baseZ, baseX)) ?? WORLD_FRAME.y;

  const sourceNormal = normalizeVec(anchor.localNormal) ?? [0, 0, -1];
  const sourceTangent = chooseAnchorSourceTangent(sourceNormal);
  const sourceBinormal =
    normalizeVec(cross(sourceNormal, sourceTangent)) ?? WORLD_FRAME.y;

  const targetNormal = scaleVec(baseZ, -1);
  const targetTangent = Math.abs(sourceTangent[2]) > 0.9 ? baseY : baseX;
  const targetBinormal =
    normalizeVec(cross(targetNormal, targetTangent)) ?? baseX;

  const worldX = mapAnchorVector(
    [1, 0, 0],
    sourceTangent,
    sourceBinormal,
    sourceNormal,
    targetTangent,
    targetBinormal,
    targetNormal,
  );
  const worldY = mapAnchorVector(
    [0, 1, 0],
    sourceTangent,
    sourceBinormal,
    sourceNormal,
    targetTangent,
    targetBinormal,
    targetNormal,
  );
  const worldZ = mapAnchorVector(
    [0, 0, 1],
    sourceTangent,
    sourceBinormal,
    sourceNormal,
    targetTangent,
    targetBinormal,
    targetNormal,
  );
  const [px, py, pz] = anchor.localPoint;

  const adjustedLocation: Vec3 = [
    location[0] - worldX[0] * px - worldY[0] * py - worldZ[0] * pz,
    location[1] - worldX[1] * px - worldY[1] * py - worldZ[1] * pz,
    location[2] - worldX[2] * px - worldY[2] * py - worldZ[2] * pz,
  ];
  return buildAx2(oc, adjustedLocation, worldZ, worldX, ax2);
}

/**
 * Handles choose anchor source tangent in the topology flow.
 */
function chooseAnchorSourceTangent(normal: Vec3): Vec3 {
  return Math.abs(normal[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
}

/**
 * Handles map anchor vector in the topology flow.
 */
function mapAnchorVector(
  vector: Vec3,
  sourceTangent: Vec3,
  sourceBinormal: Vec3,
  sourceNormal: Vec3,
  targetTangent: Vec3,
  targetBinormal: Vec3,
  targetNormal: Vec3,
): Vec3 {
  const tangent = dot(vector, sourceTangent);
  const binormal = dot(vector, sourceBinormal);
  const normal = dot(vector, sourceNormal);
  return (
    normalizeVec([
      targetTangent[0] * tangent +
        targetBinormal[0] * binormal +
        targetNormal[0] * normal,
      targetTangent[1] * tangent +
        targetBinormal[1] * binormal +
        targetNormal[1] * normal,
      targetTangent[2] * tangent +
        targetBinormal[2] * binormal +
        targetNormal[2] * normal,
    ]) ?? vector
  );
}

/**
 * Handles scale vec in the topology flow.
 */
function scaleVec(v: Vec3, scalar: number): Vec3 {
  return [v[0] * scalar, v[1] * scalar, v[2] * scalar];
}

/**
 * Handles dir to normal in the topology flow.
 */
export function dirToNormal(dir: FaceDir): [number, number, number] {
  const m: Record<FaceDir, [number, number, number]> = {
    top: [0, 0, 1],
    bottom: [0, 0, -1],
    front: [0, -1, 0],
    back: [0, 1, 0],
    right: [1, 0, 0],
    left: [-1, 0, 0],
  };
  return m[dir];
}

/**
 * Handles dir to offset axes in the topology flow.
 */
export function dirToOffsetAxes(
  dir: FaceDir,
): [[number, number, number], [number, number, number]] {
  switch (dir) {
    case 'top':
    case 'bottom':
      return [
        [1, 0, 0],
        [0, 1, 0],
      ];
    case 'front':
      return [
        [1, 0, 0],
        [0, 0, 1],
      ];
    case 'back':
      return [
        [-1, 0, 0],
        [0, 0, 1],
      ]; // viewer faces -Y: right = -X
    case 'left':
      return [
        [0, -1, 0],
        [0, 0, 1],
      ];
    case 'right':
      return [
        [0, 1, 0],
        [0, 0, 1],
      ]; // viewer faces -X: right = +Y
  }
}

/**
 * Handles placement offset axes in the topology flow.
 */
export function placementOffsetAxes(
  dir: FaceDir,
  ref: ParsedFaceRef,
): [[number, number, number], [number, number, number]] {
  if ((dir === 'top' || dir === 'bottom') && ref.subRef === undefined) {
    return [
      [1, 0, 0],
      [0, -1, 0],
    ];
  }
  return dirToOffsetAxes(dir);
}
