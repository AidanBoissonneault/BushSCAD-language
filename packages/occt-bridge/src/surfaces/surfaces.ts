/**
 * @author Aidan Boissonneault
 * @file surfaces.ts
 * @purpose Provides surfaces behavior for the surfaces in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

import type {
  IRSurfaceFill,
  IRSurfaceOffset,
  IRSurfaceThicken,
  ResolvedSelectionTarget,
  SourceSpan,
} from '@bushscad/ir';
import type { GroupBuildState, OC } from '../bridge/bridge-types.js';
import type { Vec3 } from '../core/geometry-utils.js';
import { occtError } from '../core/occt-errors.js';
import { parseFaceRef } from '../core/program-utils.js';
import {
  type RealizedTopologySelection,
  realizeTopologySelection,
  supportingFaceForEdgeLoops,
} from '../topology/resolved-selection.js';
import {
  makeFaceFromEdges,
  makeFaceFromFaceLoops,
} from './surface-boundary-loops.js';

const WORLD_Z: Vec3 = [0, 0, 1];

/**
 * Builds and registers an open surface from a sketch, face, or edge boundary.
 * Surface offsets and thickening need the source face normal later. Storing the
 * orientation with the shape keeps side-face fills from being offset globally
 * upward like top-face skins.
 */
export function buildSurfaceFillOperation(
  oc: OC,
  state: GroupBuildState,
  op: IRSurfaceFill,
): void {
  const resolved = resolveSurfaceBoundary(
    oc,
    state,
    op.boundary,
    op.span,
    op.selection?.targets[0],
  );
  state.surfaceShapes.set(op.name, resolved.shape);
  state.surfaceNormals.set(op.name, resolved.normal);
  state.surfaceMaterials.set(op.name, op.material ?? null);
}

/**
 * Offsets a surface along its own remembered normal.
 * M34 supports side-face fills such as `fill(body.outer.front)`; using
 * global Z for every offset turns those into tall misplaced sheets.
 */
export function buildSurfaceOffsetOperation(
  oc: OC,
  state: GroupBuildState,
  op: IRSurfaceOffset,
): void {
  const source = state.surfaceShapes.get(op.source);
  if (!source)
    throw occtError(`offset_surface: no surface named '${op.source}'`, op.span);
  const normal = state.surfaceNormals.get(op.source) ?? WORLD_Z;
  state.surfaceShapes.set(
    op.name,
    translateSurface(oc, source, scaleVec(normal, op.distance)),
  );
  state.surfaceNormals.set(op.name, normal);
  state.surfaceMaterials.set(
    op.name,
    op.material ?? state.surfaceMaterials.get(op.source) ?? null,
  );
}

/**
 * Thickens an open surface into a solid by extruding along that surface normal.
 * The solid conversion must follow the same orientation as offset_surface so
 * side patches become shallow covers instead of vertical global-Z slabs.
 */
export function buildSurfaceThickenOperation(
  oc: OC,
  state: GroupBuildState,
  op: IRSurfaceThicken,
): OC {
  const source = state.surfaceShapes.get(op.surfaceName);
  if (!source)
    throw occtError(`thicken: no surface named '${op.surfaceName}'`, op.span);
  const normal = state.surfaceNormals.get(op.surfaceName) ?? WORLD_Z;
  const vec = makeVec(oc, scaleVec(normal, op.thickness));
  const prism = new oc.BRepPrimAPI_MakePrism_1(source, vec, false, true);
  if (prism.IsDone && !prism.IsDone()) {
    throw occtError(
      `thicken: failed to build solid from '${op.surfaceName}'`,
      op.span,
    );
  }
  const shape = prism.Shape();
  prism.delete?.();
  vec.delete?.();
  return shape;
}

/**
 * Resolves surface boundary against the current shape and its topology labels.
 */
function resolveSurfaceBoundary(
  oc: OC,
  state: GroupBuildState,
  boundary: string,
  span: SourceSpan,
  target: ResolvedSelectionTarget | undefined,
): { shape: OC; normal: Vec3 } {
  const parsed = parseFaceRef(boundary);
  const realized = realizeTopologySelection(oc, state, target, boundary);
  const selected = surfaceFromRealizedSelection(
    oc,
    state,
    realized,
    parsed.face,
    span,
    target !== undefined,
  );
  if (selected) return selected;

  throw occtError(
    `fill: ${realized.selectorKind} selector '${boundary}' resolved to no ${realized.selectorKind === 'face' ? 'faces' : 'closed boundary edges'}`,
    span,
  );
}

/**
 * Handles surface from realized selection in the surfaces flow.
 */
function surfaceFromRealizedSelection(
  oc: OC,
  state: GroupBuildState,
  realized: RealizedTopologySelection,
  face: string | undefined,
  span: SourceSpan,
  hasExplicitTarget: boolean,
): { shape: OC; normal: Vec3 } | null {
  if (realized.sketchFace)
    return { shape: realized.sketchFace, normal: WORLD_Z };
  if (realized.bodyShape) return { shape: realized.bodyShape, normal: WORLD_Z };
  if (realized.faces.length > 0)
    return selectedFaceSurface(oc, state, realized, face);
  return selectedEdgeSurface(
    oc,
    state,
    realized,
    face,
    span,
    hasExplicitTarget,
  );
}

/**
 * Returns the selected face surface from the current operation.
 */
function selectedFaceSurface(
  oc: OC,
  state: GroupBuildState,
  realized: RealizedTopologySelection,
  face: string | undefined,
): { shape: OC; normal: Vec3 } {
  return {
    shape: realized.faces[0],
    normal:
      readPlacementNormal(oc, state, realized.label) ?? faceDirNormal(face),
  };
}

/**
 * Returns the selected edge surface from the current operation.
 */
function selectedEdgeSurface(
  oc: OC,
  state: GroupBuildState,
  realized: RealizedTopologySelection,
  face: string | undefined,
  span: SourceSpan,
  hasExplicitTarget: boolean,
): { shape: OC; normal: Vec3 } | null {
  const supportingFace =
    realized.selectorKind === 'face-edges' &&
    (realized.edges.length > 0 || !hasExplicitTarget)
      ? supportingFaceForEdgeLoops(state, realized.label)
      : undefined;
  if (realized.edges.length === 0 && !supportingFace) return null;
  return {
    shape: supportingFace
      ? makeFaceFromFaceLoops(oc, supportingFace, span)
      : makeFaceFromEdges(oc, realized.edges, span),
    normal:
      readPlacementNormal(oc, state, parentFaceLabel(realized.label)) ??
      faceDirNormal(face),
  };
}

/**
 * Returns the display label for parent face.
 */
function parentFaceLabel(label: string): string {
  return label.replace(/\.(?:edges|perimeter)(?:\..*)?$/, '');
}

/**
 * Translates surface by the supplied offset.
 */
function translateSurface(oc: OC, shape: OC, vector: Vec3): OC {
  const trsf = new oc.gp_Trsf_1();
  const vec = makeVec(oc, vector);
  trsf.SetTranslation_1(vec);
  const moved = new oc.BRepBuilderAPI_Transform_2(shape, trsf, true).Shape();
  vec.delete?.();
  trsf.delete?.();
  return moved;
}

/**
 * Reads placement normal from the supplied source.
 */
function readPlacementNormal(
  oc: OC,
  state: GroupBuildState,
  faceRef: string,
): Vec3 | null {
  try {
    const ax2 = state.labelMap.resolveAxis(oc, { faceRef }) as {
      Direction: () => {
        X: () => number;
        Y: () => number;
        Z: () => number;
        delete?: () => void;
      };
      delete?: () => void;
    };
    const dir = ax2.Direction();
    const normal = normalizeVec([dir.X(), dir.Y(), dir.Z()]);
    dir.delete?.();
    ax2.delete?.();
    return normal;
  } catch {
    return null;
  }
}

/**
 * Resolves the face data required by the current selector.
 */
function faceDirNormal(face: string | undefined): Vec3 {
  switch (face) {
    case 'front':
      return [0, -1, 0];
    case 'back':
      return [0, 1, 0];
    case 'left':
      return [-1, 0, 0];
    case 'right':
      return [1, 0, 0];
    case 'bottom':
      return [0, 0, -1];
    default:
      return WORLD_Z;
  }
}

/**
 * Constructs vec from the supplied values.
 */
function makeVec(oc: OC, vector: Vec3): OC {
  return new oc.gp_Vec_4(vector[0], vector[1], vector[2]);
}

/**
 * Handles scale vec in the surfaces flow.
 */
function scaleVec(vector: Vec3, distance: number): Vec3 {
  return [vector[0] * distance, vector[1] * distance, vector[2] * distance];
}

/**
 * Normalizes vec into the canonical form.
 */
function normalizeVec(vector: Vec3): Vec3 | null {
  const len = Math.hypot(vector[0], vector[1], vector[2]);
  if (!Number.isFinite(len) || len < 1e-9) return null;
  return [vector[0] / len, vector[1] / len, vector[2] / len];
}
