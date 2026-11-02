/**
 * @author Aidan Boissonneault
 * @file solid-primitive-geometry.ts
 * @purpose Provides solid primitive geometry behavior for the primitives in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

import type { SourceSpan } from '@bushscad/ir';
import { normalizeVec } from '../topology/frame-utils.js';
import type { Vec3 } from '../core/geometry-utils.js';
import type { OC } from '../bridge/bridge-types.js';
import type { SourceAttachmentPlane } from '../topology/source-edge-recovery.js';
import { occtError } from '../core/occt-errors.js';

/**
 * Builds a centered rectangular face on the local XY plane.
 * Cuboid primitives grow from this local bottom plane before any placement
 * transform is applied.
 */
export function rectFace(
  oc: OC,
  width: number,
  depth: number,
  span: SourceSpan,
): OC {
  return faceFromPoints(
    oc,
    [
      [-width / 2, -depth / 2, 0],
      [width / 2, -depth / 2, 0],
      [width / 2, depth / 2, 0],
      [-width / 2, depth / 2, 0],
    ],
    span,
  );
}

/**
 * Builds a rounded rectangle face on the local XY plane.
 * Rounded cuboids share the same bottom-plane placement semantics as cuboids,
 * but need an approximated corner profile before extrusion.
 */
export function roundedRectFace(
  oc: OC,
  width: number,
  depth: number,
  radius: number,
  segments: number,
  span: SourceSpan,
): OC {
  const hw = width / 2;
  const hd = depth / 2;
  const r = Math.max(0, Math.min(radius, hw, hd));
  if (r <= 1e-9) return rectFace(oc, width, depth, span);
  const points: Vec3[] = [];
  const cornerSegments = Math.max(2, Math.round(segments / 8));
  for (const [cx, cy, a0, a1] of [
    [hw - r, hd - r, 0, 90],
    [-hw + r, hd - r, 90, 180],
    [-hw + r, -hd + r, 180, 270],
    [hw - r, -hd + r, 270, 360],
  ] as const) {
    for (let i = 0; i <= cornerSegments; i++) {
      const a = ((a0 + ((a1 - a0) * i) / cornerSegments) * Math.PI) / 180;
      points.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r, 0]);
    }
  }
  return faceFromPoints(oc, points, span);
}

/**
 * Extrudes a local face along +Z into a solid primitive body.
 * BushSCAD direct solids grow upward from the bottom frame for box-like and
 * cylinder-like primitives.
 */
export function extrudeFace(
  oc: OC,
  face: OC,
  depth: number,
  span: SourceSpan,
): OC {
  const vec = new oc.gp_Vec_4(0, 0, depth);
  const prism = new oc.BRepPrimAPI_MakePrism_1(face, vec, false, true);
  try {
    if (!prism.IsDone())
      throw occtError('Solid primitive extrude failed', span);
    return prism.Shape();
  } finally {
    vec.delete();
    prism.delete?.();
    face.delete?.();
  }
}

/**
 * Revolves a local radius/Z profile around the Z axis.
 * Circular solids share a small, exact OCCT construction path while keeping
 * profile-specific logic outside the dispatcher.
 */
export function revolveProfile(
  oc: OC,
  profile: [number, number][],
  span: SourceSpan,
): OC {
  const face = faceFromPoints(
    oc,
    profile.map(([r, z]) => [r, 0, z]),
    span,
  );
  const origin = new oc.gp_Pnt_3(0, 0, 0);
  const dir = new oc.gp_Dir_4(0, 0, 1);
  const axis = new oc.gp_Ax1_2(origin, dir);
  const revol = new oc.BRepPrimAPI_MakeRevol_1(face, axis, Math.PI * 2, false);
  try {
    if (!revol.IsDone())
      throw occtError('Solid primitive revolve failed', span);
    return revol.Shape();
  } finally {
    [face, origin, dir, axis, revol].forEach((item: OC) => item.delete?.());
  }
}

/**
 * Builds a compound from explicit polygon faces.
 * Polyhedron and elliptic-cylinder primitives are face-list based in the
 * source language, so the bridge preserves those authored loops directly.
 */
export function polyhedronCompound(
  oc: OC,
  mesh: { points: Vec3[]; faces: number[][] },
  span: SourceSpan,
): OC {
  const compound = new oc.TopoDS_Compound();
  const builder = new oc.BRep_Builder();
  builder.MakeCompound(compound);
  for (const face of mesh.faces) {
    if (face.length < 3) continue;
    const built = faceFromPoints(
      oc,
      face.map((index) => mesh.points[index]).filter(Boolean),
      span,
    );
    builder.Add(compound, built);
    built.delete?.();
  }
  builder.delete?.();
  return compound;
}

/**
 * Moves a local primitive into the resolved placement axis.
 * Direct primitives are built in a stable local coordinate system, then
 * transformed using the same OCCT frame semantics as placed operations.
 */
export function transformToAxis(oc: OC, shape: OC, ax2: OC): OC {
  const trsf = new oc.gp_Trsf_1();
  const origin = new oc.gp_Pnt_3(0, 0, 0);
  const zDir = new oc.gp_Dir_4(0, 0, 1);
  const xDir = new oc.gp_Dir_4(1, 0, 0);
  const sourceAx3 = new oc.gp_Ax3_3(origin, zDir, xDir);
  const targetAx3 = new oc.gp_Ax3_2(ax2);
  trsf.SetDisplacement(sourceAx3, targetAx3);
  const moved = new oc.BRepBuilderAPI_Transform_2(shape, trsf, false).Shape();
  [trsf, origin, zDir, xDir, sourceAx3, targetAx3].forEach((item: OC) =>
    item.delete?.(),
  );
  return moved;
}

/**
 * Captures the source plane used for bottom-grown primitive recovery.
 * Source-edge recovery needs the placement plane when there is no sketch
 * object behind the primitive.
 */
export function attachmentPlane(ax2: OC): SourceAttachmentPlane {
  const loc = ax2.Location();
  const dir = ax2.Direction();
  try {
    return {
      origin: [loc.X(), loc.Y(), loc.Z()],
      normal: normalizeVec([dir.X(), dir.Y(), dir.Z()]) ?? ([0, 0, 1] as Vec3),
    };
  } finally {
    loc.delete?.();
    dir.delete?.();
  }
}

/**
 * Resolves the face data required by the current selector.
 */
function faceFromPoints(oc: OC, points: readonly Vec3[], span: SourceSpan): OC {
  const wire = wireFromPoints(oc, points);
  const maker = new oc.BRepBuilderAPI_MakeFace_15(wire, false);
  try {
    if (!maker.IsDone())
      throw occtError('Solid primitive face build failed', span);
    return maker.Face();
  } finally {
    wire.delete?.();
    maker.delete?.();
  }
}

/**
 * Handles wire from points in the primitives flow.
 */
function wireFromPoints(oc: OC, points: readonly Vec3[]): OC {
  const wb = new oc.BRepBuilderAPI_MakeWire_1();
  const handles = points.map(([x, y, z]) => new oc.gp_Pnt_3(x, y, z));
  const edges: OC[] = [];
  for (let i = 0; i < handles.length; i++) {
    const edge = new oc.BRepBuilderAPI_MakeEdge_3(
      handles[i],
      handles[(i + 1) % handles.length],
    ).Edge();
    wb.Add_1(edge);
    edges.push(edge);
  }
  const wire = wb.Wire();
  [...handles, ...edges].forEach((item) => item.delete?.());
  wb.delete?.();
  return wire;
}
