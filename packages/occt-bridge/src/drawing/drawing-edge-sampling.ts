/**
 * @author Aidan Boissonneault
 * @file drawing-edge-sampling.ts
 * @purpose Provides drawing edge sampling behavior for the drawing in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

import type { ViewFace } from '@bushscad/ir';
import type { Edge2DSegment } from './drawing-projection.js';
import { projectPoint } from './drawing-view-geometry.js';

/**
 * Alias for the dynamically loaded OpenCascade bindings, whose generated wrapper API is not
 * fully described by static declarations.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type OC = any;

const DEGENERATE_EPS = 1e-6;

/**
 * point2 represented by [number, number].
 */
type Point2 = [number, number];

/**
 * Handles vertex point in the drawing flow.
 */
function vertexPoint(oc: OC, vertex: unknown): [number, number, number] | null {
  if (!vertex) return null;
  try {
    const p = oc.BRep_Tool.Pnt(vertex);
    const point: [number, number, number] = [p.X(), p.Y(), p.Z()];
    p?.delete?.();
    return point;
  } catch {
    return null;
  }
}

/** Sample a 3D edge curve, preserving arcs as short polylines for SVG/DXF. */
export function sampleEdge(oc: OC, edge: unknown): [number, number, number][] {
  const firstVertex = oc.TopExp.FirstVertex(edge, true);
  const lastVertex = oc.TopExp.LastVertex(edge, true);
  const start = vertexPoint(oc, firstVertex);
  const end = vertexPoint(oc, lastVertex);

  try {
    const uMin = { current: 0 };
    const uMax = { current: 0 };
    const curveHandle = oc.BRep_Tool.Curve_2?.(edge, uMin, uMax);
    const curve =
      typeof curveHandle?.get === 'function' ? curveHandle.get() : curveHandle;

    if (curve && !curve.IsNull?.()) {
      const t0 = uMin.current;
      const t1 = uMax.current;
      const range = t1 - t0;
      const tMid = t0 + range * 0.5;
      const pMid = curve.Value(tMid);
      const mid: [number, number, number] = [pMid.X(), pMid.Y(), pMid.Z()];
      pMid.delete?.();

      const fallbackMid =
        start && end
          ? [
              (start[0] + end[0]) / 2,
              (start[1] + end[1]) / 2,
              (start[2] + end[2]) / 2,
            ]
          : mid;
      const dist = Math.sqrt(
        (mid[0] - fallbackMid[0]) ** 2 +
          (mid[1] - fallbackMid[1]) ** 2 +
          (mid[2] - fallbackMid[2]) ** 2,
      );

      const segments = dist < 0.001 ? 1 : 32;
      const result: [number, number, number][] = [];
      for (let i = 0; i <= segments; i++) {
        const t = t0 + (range * i) / segments;
        const pt = curve.Value(t);
        result.push([pt.X(), pt.Y(), pt.Z()]);
        pt.delete?.();
      }
      curveHandle?.delete?.();
      return result;
    }
    curveHandle?.delete?.();
  } catch {
    // Fall through to endpoint sampling.
  } finally {
    firstVertex?.delete?.();
    lastVertex?.delete?.();
  }

  return start && end ? [start, end] : [];
}

/**
 * Samples all edges in a wire as one continuous projected ring.
 *
 * OCCT wire explorers preserve edge order but an individual edge curve can be
 * stored opposite to the wire traversal direction. Joining each sampled edge
 * to the nearest prior endpoint prevents filled SVG paths from crossing the
 * face when that orientation differs.
 */
export function sampleWireToPoints(
  oc: OC,
  wire: unknown,
  viewFace: ViewFace,
): [number, number][] {
  const points: [number, number][] = [];
  if (typeof oc.BRepTools_WireExplorer_2 === 'function') {
    try {
      const wireExp = new oc.BRepTools_WireExplorer_2(wire);
      for (; wireExp.More(); wireExp.Next()) {
        const edge = oc.TopoDS.Edge_1(wireExp.Current());
        appendSampledEdge(oc, edge, points, viewFace);
      }
      wireExp.delete?.();
      return points;
    } catch {
      points.length = 0;
    }
  }

  try {
    const edgeExp = new oc.TopExp_Explorer_2(
      wire,
      oc.TopAbs_ShapeEnum.TopAbs_EDGE,
      oc.TopAbs_ShapeEnum.TopAbs_SHAPE,
    );
    for (; edgeExp.More(); edgeExp.Next()) {
      const edge = oc.TopoDS.Edge_1(edgeExp.Current());
      appendSampledEdge(oc, edge, points, viewFace);
    }
    edgeExp.delete();
  } catch {
    // Return partial points gathered before OCCT failed.
  }
  return points;
}

/**
 * Samples one edge and joins its projected points to a wire ring.
 *
 * Why: OCCT's wire explorer and generic shape explorer must apply identical
 * orientation and endpoint handling when either traversal path is used.
 */
function appendSampledEdge(
  oc: OC,
  edge: unknown,
  target: Point2[],
  viewFace: ViewFace,
): void {
  const points = sampleEdge(oc, edge).map((point) =>
    projectPoint(...point, viewFace),
  );
  appendConnectedPoints(target, points);
  (edge as { delete?: () => void }).delete?.();
}

/**
 * Appends connected points to the current output.
 */
function appendConnectedPoints(target: Point2[], edgePoints: Point2[]): void {
  if (edgePoints.length === 0) return;
  if (target.length === 0) {
    target.push(...edgePoints);
    return;
  }
  const previous = target[target.length - 1];
  const firstDistance = squaredDistance(previous, edgePoints[0]);
  const lastDistance = squaredDistance(
    previous,
    edgePoints[edgePoints.length - 1],
  );
  const ordered =
    lastDistance < firstDistance ? edgePoints.reverse() : edgePoints;
  const start =
    squaredDistance(previous, ordered[0]) < DEGENERATE_EPS ** 2 ? 1 : 0;
  target.push(...ordered.slice(start));
}

/**
 * Handles squared distance in the drawing flow.
 */
function squaredDistance(left: Point2, right: Point2): number {
  return (left[0] - right[0]) ** 2 + (left[1] - right[1]) ** 2;
}

/** Sample one edge as projected visible/hidden drawing line segments. */
export function sampleEdgeToSegments(
  oc: OC,
  edge: unknown,
  viewFace: ViewFace,
): Edge2DSegment[] {
  const pts = sampleEdge(oc, edge);
  const segments: Edge2DSegment[] = [];
  for (let i = 0; i + 1 < pts.length; i++) {
    const [x1, y1] = projectPoint(...pts[i], viewFace);
    const [x2, y2] = projectPoint(...pts[i + 1], viewFace);
    if (
      Math.abs(x2 - x1) < DEGENERATE_EPS &&
      Math.abs(y2 - y1) < DEGENERATE_EPS
    ) {
      continue;
    }
    segments.push({ x1, y1, x2, y2 });
  }
  return segments;
}
