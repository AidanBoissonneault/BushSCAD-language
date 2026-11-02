/**
 * @author Aidan Boissonneault
 * @file drawing-face-edge-geometry.ts
 * @purpose Provides drawing face edge geometry behavior for the drawing in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

import type { ViewFace } from '@bushscad/ir';
import type { Edge2DSegment } from './drawing-projection.js';
import { sampleEdge } from './drawing-edge-sampling.js';
import { projectPoint, viewDirectionVector } from './drawing-view-geometry.js';

/**
 * Alias for the dynamically loaded OpenCascade bindings, whose generated wrapper API is not
 * fully described by static declarations.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type OC = any;

/**
 * Face edge geometry, including segments, depth min, and depth max.
 */
type FaceEdgeGeometry = {
  segments: Edge2DSegment[];
  depthMin: number;
  depthMax: number;
};

/**
 * Resolves the face data required by the current selector.
 */
export function faceEdgeGeometry(
  oc: OC,
  face: unknown,
  viewFace: ViewFace,
): FaceEdgeGeometry {
  const segments: Edge2DSegment[] = [];
  let depthMin = Infinity;
  let depthMax = -Infinity;
  const [vx, vy, vz] = viewDirectionVector(viewFace);
  const edgeExp = new oc.TopExp_Explorer_2(
    face,
    oc.TopAbs_ShapeEnum.TopAbs_EDGE,
    oc.TopAbs_ShapeEnum.TopAbs_SHAPE,
  );
  for (; edgeExp.More(); edgeExp.Next()) {
    const edge = oc.TopoDS.Edge_1(edgeExp.Current());
    const points = sampleEdge(oc, edge);
    for (const [x, y, z] of points) {
      const depth = x * vx + y * vy + z * vz;
      depthMin = Math.min(depthMin, depth);
      depthMax = Math.max(depthMax, depth);
    }
    appendProjectedEdgeSegments(segments, points, viewFace);
    edge.delete?.();
  }
  edgeExp.delete();
  return depthMin === Infinity
    ? { segments, depthMin: 0, depthMax: 0 }
    : {
        segments,
        depthMin,
        depthMax,
      };
}

/**
 * Appends projected edge segments to the current output.
 */
function appendProjectedEdgeSegments(
  segments: Edge2DSegment[],
  points: [number, number, number][],
  viewFace: ViewFace,
): void {
  for (let i = 0; i + 1 < points.length; i++) {
    const [x1, y1] = projectPoint(...points[i], viewFace);
    const [x2, y2] = projectPoint(...points[i + 1], viewFace);
    if (Math.abs(x2 - x1) >= 1e-6 || Math.abs(y2 - y1) >= 1e-6) {
      segments.push({ x1, y1, x2, y2 });
    }
  }
}
