/**
 * @author Aidan Boissonneault
 * @file drawing-face-projection.ts
 * @purpose Provides drawing face projection behavior for the drawing in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

import type { ViewFace } from '@bushscad/ir';
import type { Edge2DSegment, Face2DPolygon } from './drawing-projection.js';
import {
  sampleEdgeToSegments,
  sampleWireToPoints,
} from './drawing-edge-sampling.js';
import { forEachShapeFace } from '../topology/shape-explorers.js';
import { faceEdgeGeometry } from './drawing-face-edge-geometry.js';
import { viewDirectionVector } from './drawing-view-geometry.js';

/**
 * Alias for the dynamically loaded OpenCascade bindings, whose generated wrapper API is not
 * fully described by static declarations.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type OC = any;

/**
 * Face projection, including dot, depth, depth min, depth max, and outer boundary points.
 */
type FaceProjection = {
  dot: number;
  depth: number;
  depthMin: number;
  depthMax: number;
  outerPoints: [number, number][];
  innerRings: [number, number][][];
  edgeSegments: Edge2DSegment[];
};

/**
 * Handles reversed orientation in the drawing flow.
 */
function reversedOrientation(oc: OC, face: unknown): boolean {
  try {
    const orient = (face as { Orientation?: () => unknown }).Orientation?.();
    return orient === 1 || orient === oc.TopAbs_Orientation?.TopAbs_REVERSED;
  } catch {
    return false;
  }
}

/**
 * Handles normal from surface in the drawing flow.
 */
function normalFromSurface(
  oc: OC,
  face: unknown,
): [number, number, number] | null {
  try {
    return readSurfaceNormal(oc, face);
  } catch {
    return null;
  }
}

/**
 * Reads surface normal from the supplied source.
 */
function readSurfaceNormal(
  oc: OC,
  face: unknown,
): [number, number, number] | null {
  const bounds = surfaceUvMidpoint(oc, face);
  const surface = oc.BRep_Tool.Surface_2(face);
  if (!surface || surface.IsNull?.()) return null;
  const props = new oc.GeomLProp_SLProps_2(
    surface,
    bounds.u,
    bounds.v,
    2,
    1e-7,
  );
  surface.delete?.();
  return normalFromSurfaceProps(props);
}

/**
 * Handles surface uv midpoint in the drawing flow.
 */
function surfaceUvMidpoint(oc: OC, face: unknown): { u: number; v: number } {
  const uMin = { current: 0 },
    uMax = { current: 0 };
  const vMin = { current: 0 },
    vMax = { current: 0 };
  oc.BRepTools.UVBounds_1(face, uMin, uMax, vMin, vMax);
  return {
    u: (uMin.current + uMax.current) / 2,
    v: (vMin.current + vMax.current) / 2,
  };
}

/**
 * Handles normal from surface props in the drawing flow.
 */
function normalFromSurfaceProps(props: {
  IsNormalDefined(): boolean;
  Normal(): unknown;
  delete?: () => void;
}): [number, number, number] | null {
  if (!props.IsNormalDefined()) {
    props.delete?.();
    return null;
  }
  const normal = props.Normal() as {
    X(): number;
    Y(): number;
    Z(): number;
    delete?: () => void;
  };
  const result: [number, number, number] = [normal.X(), normal.Y(), normal.Z()];
  normal.delete?.();
  props.delete?.();
  return result;
}

/**
 * Handles normal from face props in the drawing flow.
 */
function normalFromFaceProps(
  oc: OC,
  face: unknown,
): [number, number, number] | null {
  try {
    const props = new oc.BRepGProp_Face_2(face);
    const uMin = { current: 0 },
      uMax = { current: 0 };
    const vMin = { current: 0 },
      vMax = { current: 0 };
    props.Bounds(uMin, uMax, vMin, vMax);
    const point = new oc.gp_Pnt_1();
    const normal = new oc.gp_Vec_1();
    props.Normal(
      (uMin.current + uMax.current) / 2,
      (vMin.current + vMax.current) / 2,
      point,
      normal,
    );
    const result: [number, number, number] = [
      normal.X(),
      normal.Y(),
      normal.Z(),
    ];
    point.delete?.();
    normal.delete?.();
    props.delete?.();
    return result;
  } catch {
    return null;
  }
}

/** Compute face/view alignment; positive values face the drawing viewer. */
function faceDotViewDir(
  oc: OC,
  face: unknown,
  viewFace: ViewFace,
): number | null {
  const normal = normalFromSurface(oc, face) ?? normalFromFaceProps(oc, face);
  if (!normal) return null;
  let [nx, ny, nz] = normal;
  if (reversedOrientation(oc, face)) {
    nx = -nx;
    ny = -ny;
    nz = -nz;
  }
  const [vx, vy, vz] = viewDirectionVector(viewFace);
  return nx * vx + ny * vy + nz * vz;
}

/**
 * Resolves the edge data required by the current selector.
 */
function edgeKey(segment: Edge2DSegment): string {
  const a = `${segment.x1.toFixed(5)},${segment.y1.toFixed(5)}`;
  const b = `${segment.x2.toFixed(5)},${segment.y2.toFixed(5)}`;
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/**
 * Handles push unique in the drawing flow.
 */
function pushUnique(
  target: Edge2DSegment[],
  seen: Set<string>,
  segments: Edge2DSegment[],
): void {
  for (const segment of segments) {
    const key = edgeKey(segment);
    if (seen.has(key)) continue;
    seen.add(key);
    target.push(segment);
  }
}

/**
 * Handles project face in the drawing flow.
 */
function projectFace(
  oc: OC,
  face: unknown,
  viewFace: ViewFace,
): FaceProjection | null {
  const dot = faceDotViewDir(oc, face, viewFace);
  if (dot !== null && dot <= 0.01) return null;
  try {
    const outerWire = oc.BRepTools.OuterWire(face);
    const outerPoints = sampleWireToPoints(oc, outerWire, viewFace);
    outerWire.delete?.();
    if (outerPoints.length < 3) return null;

    const geometry = faceEdgeGeometry(oc, face, viewFace);
    return {
      dot: dot ?? 0,
      depth: geometry.depthMax,
      depthMin: geometry.depthMin,
      depthMax: geometry.depthMax,
      outerPoints,
      innerRings: faceInnerRings(oc, face, viewFace),
      edgeSegments: geometry.segments,
    };
  } catch {
    return null;
  }
}

/**
 * Resolves the face data required by the current selector.
 */
function faceInnerRings(
  oc: OC,
  face: unknown,
  viewFace: ViewFace,
): [number, number][][] {
  const innerRings: [number, number][][] = [];
  const outerWireCheck = oc.BRepTools.OuterWire(face);
  const wireExp = new oc.TopExp_Explorer_2(
    face,
    oc.TopAbs_ShapeEnum.TopAbs_WIRE,
    oc.TopAbs_ShapeEnum.TopAbs_SHAPE,
  );
  for (; wireExp.More(); wireExp.Next()) {
    const wire = oc.TopoDS.Wire_1(wireExp.Current());
    if (!wire.IsSame?.(outerWireCheck)) {
      const innerPts = sampleWireToPoints(oc, wire, viewFace);
      if (innerPts.length >= 3) innerRings.push(innerPts);
    }
    wire.delete?.();
  }
  wireExp.delete();
  outerWireCheck.delete?.();
  return innerRings;
}

/**
 * Handles frontmost faces in the drawing flow.
 */
function frontmostFaces(faces: FaceProjection[]): FaceProjection[] {
  const maxDepth = Math.max(...faces.map((face) => face.depthMax));
  const candidates = faces.filter(
    (face) => Math.abs(face.depthMax - maxDepth) < 1e-6,
  );
  const coplanar = candidates.filter(
    (face) => Math.abs(face.depthMin - face.depthMax) < 1e-5,
  );
  return coplanar.length > 0 ? coplanar : candidates;
}

/**
 * Handles visible faces in the drawing flow.
 */
function visibleFaces(
  oc: OC,
  shape: unknown,
  viewFace: ViewFace,
): FaceProjection[] {
  const faces: FaceProjection[] = [];
  const unknownNormalFaces: FaceProjection[] = [];
  forEachShapeFace(oc, shape, (face) => {
    const projected = projectFace(oc, face, viewFace);
    if (projected) {
      if (projected.dot > 0.01) faces.push(projected);
      else unknownNormalFaces.push(projected);
    }
    face.delete?.();
  });
  if (faces.length > 0) return frontmostFaces(faces);
  return unknownNormalFaces.length > 0
    ? frontmostFaces(unknownNormalFaces)
    : [];
}

/** Project shape edges into visible and hidden drawing layers. */
export function projectShapeToClassifiedEdges(
  oc: OC,
  shape: unknown,
  viewFace: ViewFace,
): { visible: Edge2DSegment[]; hidden: Edge2DSegment[] } {
  const visible: Edge2DSegment[] = [];
  const hidden: Edge2DSegment[] = [];
  const visibleKeys = new Set<string>();
  const faces = visibleFaces(oc, shape, viewFace);
  for (const face of faces) {
    pushUnique(visible, visibleKeys, face.edgeSegments);
  }

  const hiddenKeys = new Set<string>();
  const edgeExp = new oc.TopExp_Explorer_2(
    shape,
    oc.TopAbs_ShapeEnum.TopAbs_EDGE,
    oc.TopAbs_ShapeEnum.TopAbs_SHAPE,
  );
  for (; edgeExp.More(); edgeExp.Next()) {
    const edge = oc.TopoDS.Edge_1(edgeExp.Current());
    const segments = sampleEdgeToSegments(oc, edge, viewFace).filter(
      (segment) => !visibleKeys.has(edgeKey(segment)),
    );
    pushUnique(
      faces.length > 0 ? hidden : visible,
      faces.length > 0 ? hiddenKeys : visibleKeys,
      segments,
    );
    edge.delete?.();
  }
  edgeExp.delete();

  return { visible, hidden };
}

/** Project OCCT shape to filled visible face polygons with inner holes. */
export function projectShapeToFaces(
  oc: OC,
  shape: unknown,
  viewFace: ViewFace,
  color: string,
): Face2DPolygon[] {
  return visibleFaces(oc, shape, viewFace)
    .map((face) => ({
      outerPoints: face.outerPoints,
      innerRings: face.innerRings,
      color,
      depth: face.depth,
    }))
    .sort((a, b) => a.depth - b.depth);
}

/** Project a shape to visible edges only. */
export function projectShapeToEdges(
  oc: OC,
  shape: unknown,
  face: ViewFace,
): Edge2DSegment[] {
  return projectShapeToClassifiedEdges(oc, shape, face).visible;
}
