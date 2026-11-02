/**
 * @author Aidan Boissonneault
 * @file geometry-utils.ts
 * @purpose Provides geometry utils behavior for the core in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

import type { Workplane } from '@bushscad/ir';

/**
 * Alias for the dynamically loaded OpenCascade bindings, whose generated wrapper API is not
 * fully described by static declarations.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type OC = any;

/**
 * vec3 represented by [number, number, number].
 */
export type Vec3 = [number, number, number];

/**
 * Bounds, including x min, x max, y min, y max, and z min.
 */
export type Bounds = {
  xMin: { current: number };
  xMax: { current: number };
  yMin: { current: number };
  yMax: { current: number };
  zMin: { current: number };
  zMax: { current: number };
};

/**
 * Constructs default axis from the supplied values.
 */
export function makeDefaultAxis(oc: OC): OC {
  return makeWorkplaneAxis(oc, 'XY');
}

/**
 * Constructs workplane axis from the supplied values.
 */
export function makeWorkplaneAxis(oc: OC, workplane: Workplane): OC {
  const dirs: Record<Workplane, { normal: Vec3; x: Vec3 }> = {
    XY: { normal: [0, 0, 1], x: [1, 0, 0] },
    XZ: { normal: [0, -1, 0], x: [1, 0, 0] },
    YZ: { normal: [1, 0, 0], x: [0, 1, 0] },
  };
  const { normal, x } = dirs[workplane];
  const origin = new oc.gp_Pnt_3(0, 0, 0);
  const zDir = new oc.gp_Dir_4(...normal);
  const xDir = new oc.gp_Dir_4(...x);
  const ax2 = new oc.gp_Ax2_2(origin, zDir, xDir);
  origin.delete();
  zDir.delete();
  xDir.delete();
  return ax2;
}

/**
 * Calculates the bounds of the supplied geometry.
 */
export function boundsOverlap(a: Bounds, b: Bounds, tol = 1e-6): boolean {
  return (
    a.xMax.current >= b.xMin.current - tol &&
    a.xMin.current <= b.xMax.current + tol &&
    a.yMax.current >= b.yMin.current - tol &&
    a.yMin.current <= b.yMax.current + tol &&
    a.zMax.current >= b.zMin.current - tol &&
    a.zMin.current <= b.zMax.current + tol
  );
}

/**
 * Reads bounds from the supplied source.
 */
export function readBounds(oc: OC, shape: unknown): Bounds {
  const bbox = new oc.Bnd_Box_1();
  oc.BRepBndLib.Add(shape, bbox, false);
  const xMin = { current: 0 };
  const yMin = { current: 0 };
  const zMin = { current: 0 };
  const xMax = { current: 0 };
  const yMax = { current: 0 };
  const zMax = { current: 0 };
  bbox.Get(xMin, yMin, zMin, xMax, yMax, zMax);
  bbox.delete();
  return { xMin, xMax, yMin, yMax, zMin, zMax };
}

/**
 * Returns edges from the supplied input.
 */
export function getEdges(oc: OC, shape: unknown): unknown[] {
  const edges: unknown[] = [];
  const exp = new oc.TopExp_Explorer_2(
    shape,
    oc.TopAbs_ShapeEnum.TopAbs_EDGE,
    oc.TopAbs_ShapeEnum.TopAbs_SHAPE,
  );
  for (; exp.More(); exp.Next()) {
    edges.push(oc.TopoDS.Edge_1(exp.Current()));
  }
  exp.delete();
  return edges;
}

/**
 * Reads edge endpoints from the supplied source.
 */
export function readEdgeEndpoints(oc: OC, edge: unknown): [Vec3, Vec3] {
  const firstVertex = oc.TopExp.FirstVertex(edge, true);
  const lastVertex = oc.TopExp.LastVertex(edge, true);
  const firstPoint = oc.BRep_Tool.Pnt(firstVertex);
  const lastPoint = oc.BRep_Tool.Pnt(lastVertex);
  const first: Vec3 = [firstPoint.X(), firstPoint.Y(), firstPoint.Z()];
  const last: Vec3 = [lastPoint.X(), lastPoint.Y(), lastPoint.Z()];
  firstVertex?.delete?.();
  lastVertex?.delete?.();
  firstPoint?.delete?.();
  lastPoint?.delete?.();
  return [first, last];
}
