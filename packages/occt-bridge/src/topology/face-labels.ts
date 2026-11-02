/**
 * @author Aidan Boissonneault
 * @file face-labels.ts
 * @purpose Provides face labels behavior for the topology in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

import type { IRPlacement } from '@bushscad/ir';
import { bounds3FromPoints } from '@bushscad/ir';
import { parseFaceRef } from '../core/program-utils.js';
import type { FaceDir, ParsedFaceRef } from '../core/program-utils.js';
import { selectOuterFaceEdges } from './face-edge-selection.js';
import { selectSampledOuterLoopEdges } from './face-perimeter-loops.js';
import {
  getEdges,
  makeDefaultAxis,
  readBounds,
  readEdgeEndpoints,
  type Bounds,
  type Vec3,
} from '../core/geometry-utils.js';
import { sampleEdge } from '../drawing/drawing-edge-sampling.js';
import { crossVec as cross, normalizeVec } from './frame-utils.js';
import {
  recoverConsumedSourceEdges,
  type SourceAttachmentPlane,
} from './source-edge-recovery.js';
import { sameShape, uniqueShapes } from './shape-collection.js';
import { selectWholeShapeEdges } from './whole-shape-edge-selection.js';
import {
  distanceFromLine,
  projectionRange,
  rangesOverlap,
  subtractVec,
} from '../core/vector-math.js';
import {
  WORLD_FRAME,
  applyPlacementAnchor,
  dirToNormal,
  dirToOffsetAxes,
  dot,
  faceFrameFromAx2,
  makePointFromLocal,
  placementOffsetAxes,
  rotateAxisAroundLocalAxes,
  rotateAxisAroundNormal,
  toLocalPoint,
  toLocalVector,
  toWorldVector,
  translateAxisAlongNormal,
} from './face-placement-transform.js';
import type { OC } from './face-placement-transform.js';
export { faceFrameFromAx2 };

const COS45 = 0.707;

const BOUNDARY_TOLERANCE = 2e-3;

/**
 * Accepted values for axis are '0', '1', and '2'.
 */
type Axis = 0 | 1 | 2;

/**
 * boundary represented by readonly [axis: Axis, value: number].
 */
type Boundary = readonly [axis: Axis, value: number];

/**
 * Face predicate mode, including want planar, want cylindrical, and want largest.
 */
type FacePredicateMode = {
  wantPlanar: boolean;
  wantCylindrical: boolean;
  wantLargest: boolean;
};

/**
 * Face frame, including x, y, and z.
 */
export interface FaceFrame {
  x: Vec3;
  y: Vec3;
  z: Vec3;
}

/**
 * Entry in face, including dir, qualifier, face, center, and local center.
 */
export interface FaceEntry {
  dir: FaceDir;
  qualifier: 'inner' | 'outer';
  face: unknown; // TopoDS_Face
  center: Vec3;
  localCenter: Vec3;
}

/**
 * Entry in shape, including shape, faces, edge mode, frame, and region bounds.
 */
export interface ShapeEntry {
  shape: unknown; // TopoDS_Shape
  faces: FaceEntry[];
  edgeMode: 'outer' | 'inner' | 'all';
  frame: FaceFrame;
  regionBounds?: Bounds;
  regionLocalBounds?: Bounds;
  regionTag?: unknown;
  regionName?: string;
  regionToolKind?: string;
  source?: SourceShapeEntry;
  attachmentPlane?: SourceAttachmentPlane;
}

/**
 * Entry in source shape, including shape, faces, edge mode, frame, and local bounds.
 */
export interface SourceShapeEntry {
  shape: unknown;
  faces: FaceEntry[];
  edgeMode: 'outer' | 'inner' | 'all';
  frame: FaceFrame;
  localBounds: Bounds;
  attachmentPlane?: SourceAttachmentPlane;
}

/**
 * Axis base resolution, including ax2, entry, face dir, parsed, and apply transforms.
 */
export type AxisBaseResolution = {
  ax2: unknown;
  entry: ShapeEntry | null;
  faceDir: FaceDir | null;
  parsed: ParsedFaceRef;
  applyTransforms: boolean;
};

/**
 * Handles registered shape entry in the topology flow.
 */
function registeredShapeEntry(
  oc: OC,
  name: string,
  shape: unknown,
  edgeMode: ShapeEntry['edgeMode'],
  frame: FaceFrame,
  regionShape?: unknown,
  attachmentPlane?: SourceAttachmentPlane,
): ShapeEntry {
  const source = sourceShapeEntry(
    oc,
    regionShape,
    edgeMode,
    frame,
    attachmentPlane,
  );
  return {
    shape,
    faces: classifyFaces(oc, shape, frame, regionShape),
    edgeMode,
    frame,
    ...registeredRegionMetadata(oc, name, regionShape, frame),
    ...(source ? { source } : {}),
    ...(attachmentPlane ? { attachmentPlane } : {}),
  };
}

/**
 * Returns the source data required by the current operation.
 */
function sourceShapeEntry(
  oc: OC,
  regionShape: unknown,
  edgeMode: ShapeEntry['edgeMode'],
  frame: FaceFrame,
  attachmentPlane?: SourceAttachmentPlane,
): SourceShapeEntry | undefined {
  return regionShape
    ? captureSourceShapeEntry(oc, regionShape, edgeMode, frame, attachmentPlane)
    : undefined;
}

/**
 * Handles registered region metadata in the topology flow.
 */
function registeredRegionMetadata(
  oc: OC,
  name: string,
  regionShape: unknown,
  frame: FaceFrame,
): Partial<ShapeEntry> {
  if (!regionShape) return {};
  return {
    regionBounds: readBounds(oc, regionShape),
    regionLocalBounds: getBounds(oc, regionShape, frame),
    regionName: name,
    ...regionToolMetadata(regionShape),
    ...regionTagMetadata(regionShape),
  };
}

/**
 * Handles region tool metadata in the topology flow.
 */
function regionToolMetadata(regionShape: unknown): Partial<ShapeEntry> {
  const regionToolKind = (regionShape as { _solidCutToolKind?: string })
    ._solidCutToolKind;
  return regionToolKind ? { regionToolKind } : {};
}

/**
 * Handles region tag metadata in the topology flow.
 */
function regionTagMetadata(regionShape: unknown): Partial<ShapeEntry> {
  const regionTag = (regionShape as { _region?: unknown })._region;
  return regionTag ? { regionTag } : {};
}

// Maintains a mapping from symbolic object names to OCCT shapes + classified faces.
// Updated after every extrude/cut/shell op so subsequent ops see the current topology.
/**
 * Owns `FaceLabelMap` state and behavior for the topology layer.
 */
export class FaceLabelMap {
  private map = new Map<string, ShapeEntry>();
  private namedFaceEdges = new Map<string, Map<string, unknown[]>>();

  /**
   * Initializes the `FaceLabelMap` instance with the values supplied by its caller.
   */
  constructor(private readonly fallback: FaceLabelMap | null = null) {}

  /**
   * Handles register in the topology flow.
   */
  register(
    oc: OC,
    name: string,
    shape: unknown,
    edgeMode: 'outer' | 'inner' | 'all' = 'outer',
    frame: FaceFrame = WORLD_FRAME,
    regionShape?: unknown,
    attachmentPlane?: SourceAttachmentPlane,
  ): void {
    this.map.set(
      name,
      registeredShapeEntry(
        oc,
        name,
        shape,
        edgeMode,
        frame,
        regionShape,
        attachmentPlane,
      ),
    );
  }

  /**
   * Checks whether the input has shape.
   */
  hasShape(name: string): boolean {
    return this.getEntry(name) !== undefined;
  }

  /**
   * Returns shape from the supplied input.
   */
  getShape(name: string): unknown | undefined {
    return this.getEntry(name)?.shape;
  }

  /**
   * Handles register named face edges in the topology flow.
   */
  registerNamedFaceEdges(
    objName: string,
    faceName: string,
    edges: unknown[],
  ): void {
    const byObject = this.namedFaceEdges.get(objName) ?? new Map();
    byObject.set(faceName, edges);
    this.namedFaceEdges.set(objName, byObject);
  }

  /**
   * Returns named face-edge registrations for an object.
   * Placed ref instances are new OCCT shapes, but their user-facing profile
   * segment labels must be copied from the source body to the instance.
   */
  getNamedFaceEdgeEntries(objName: string): Array<[string, unknown[]]> {
    const byObject =
      this.namedFaceEdges.get(objName) ??
      this.fallback?.namedFaceEdges.get(objName);
    if (!byObject) return [];
    return [...byObject.entries()].map(([name, edges]) => [name, [...edges]]);
  }

  /**
   * Returns all face handles from the supplied input.
   */
  getAllFaceHandles(objName: string): unknown[] {
    return this.getEntry(objName)?.faces.map((f) => f.face) ?? [];
  }

  /** Returns every surviving face belonging to one modeled feature region. */
  getFeatureFaceHandles(objName: string): unknown[] {
    const entry = this.getEntry(objName);
    if (!entry) return [];
    const faces = entry.regionBounds
      ? filterFacesToRegion(
          entry.faces,
          entry.regionBounds,
          entry.regionTag,
          entry.regionName,
        )
      : entry.faces;
    return faces.map((face) => face.face);
  }

  /** Returns all rim and internal edges of one complete modeled feature. */
  getFeatureEdgeHandles(oc: OC, objName: string): unknown[] {
    return uniqueEdges(
      this.getFeatureFaceHandles(objName).flatMap((face) => getEdges(oc, face)),
    );
  }

  /**
   * Resolves semantic face labels to the current concrete topology.
   * Interaction ownership must reuse the bridge's exact directional, curved,
   * predicate, qualifier, and region rules instead of widening to every face.
   */
  resolveSemanticFaceHandles(oc: OC, ref: string): unknown[] {
    const parsed = parseFaceRef(ref);
    const entry = this.getEntry(parsed.objName);
    if (!entry) return [];
    if (parsed.curved) {
      return entry.faces
        .filter((face) => isFaceCylindrical(oc, face.face))
        .map((face) => face.face);
    }
    if (parsed.namedFace) {
      const face = selectFaceByPredicate(
        oc,
        entry,
        parsed.namedFace,
        parsed.namedFaceFilters,
      );
      return face ? [face] : [];
    }
    if (!parsed.face) return entry.faces.map((face) => face.face);
    return filterFacesToRegion(
      matchFaces(entry, parsed.face, effectiveFaceQualifier(entry, parsed)),
      entry.regionBounds,
      entry.regionTag,
      entry.regionName,
    ).map((face) => face.face);
  }

  // Returns OCCT face handles matching a dir on a named object.
  /**
   * Returns face handles from the supplied input.
   */
  getFaceHandles(
    objName: string,
    dir: FaceDir,
    qualifier: 'inner' | 'outer' = 'outer',
  ): unknown[] {
    const entry = this.getEntry(objName);
    if (!entry) return [];
    return filterFacesToRegion(
      matchFaces(entry, dir, qualifier),
      entry.regionBounds,
      entry.regionTag,
      entry.regionName,
    ).map((f) => f.face);
  }

  /**
   * Returns blend edges from the supplied input.
   */
  getBlendEdges(oc: OC, ref: string): unknown[] {
    return this.resolveEdgesInternal(oc, ref, true);
  }

  /**
   * Checks whether the input has source memory.
   */
  hasSourceMemory(objName: string): boolean {
    return this.getEntry(objName)?.source !== undefined;
  }

  // Returns all edges on the face(s) matching `ref` (e.g. "base.top.edges").
  /**
   * Resolves edges against the current shape and its topology labels.
   */
  resolveEdges(oc: OC, ref: string): unknown[] {
    return this.resolveEdgesInternal(oc, ref, false);
  }

  /**
   * Resolves edges internal against the current shape and its topology labels.
   */
  private resolveEdgesInternal(
    oc: OC,
    ref: string,
    preferSourceMemory: boolean,
  ): unknown[] {
    const parsed = parseFaceRef(ref);
    const entry = this.getEntry(parsed.objName);
    const faceDir = parsed.face;
    if (!entry) return [];
    if (parsed.namedFace) {
      return this.resolveNamedFaceEdges(parsed);
    }
    if (!faceDir) {
      return resolveWholeShapeEdges(oc, entry, parsed, preferSourceMemory);
    }
    if (preferSourceMemory && entry.edgeMode !== 'inner') {
      const sourceMatches = this.resolveSourceMemoryEdges(
        oc,
        parsed,
        entry,
        faceDir,
      );
      if (sourceMatches.length > 0) return sourceMatches;
    }

    return resolveCurrentEdges(oc, entry, faceDir, parsed);
  }

  /**
   * Resolves named face edges against the current shape and its topology labels.
   */
  private resolveNamedFaceEdges(parsed: ParsedFaceRef): unknown[] {
    const named =
      this.namedFaceEdges.get(parsed.objName)?.get(parsed.namedFace!) ??
      this.fallback?.namedFaceEdges
        .get(parsed.objName)
        ?.get(parsed.namedFace!) ??
      [];
    return parsed.subRef === undefined || parsed.subRef === 'edges'
      ? uniqueEdges(named)
      : [];
  }

  /**
   * Resolves source memory edges against the current shape and its topology labels.
   */
  private resolveSourceMemoryEdges(
    oc: OC,
    parsed: ParsedFaceRef,
    entry: ShapeEntry,
    faceDir: FaceDir,
  ): unknown[] {
    const sourceEdges = resolveSourceEdges(oc, entry, faceDir, parsed);
    if (sourceEdges.length === 0) return [];
    const currentMatches = matchSourceEdgesInCurrentShape(
      oc,
      entry,
      sourceEdges,
    );
    if (currentMatches.length > 0) {
      return this.mergeCurrentEdgesWithSourceMatches(
        oc,
        parsed.objName,
        entry,
        faceDir,
        parsed,
        currentMatches,
      );
    }
    const consumedMatches = recoverConsumedSourceEdges({
      oc,
      shape: entry.shape,
      frame: entry.frame,
      sourceEdges,
      attachmentPlane: entry.source?.attachmentPlane,
    });
    return consumedMatches.length > 0
      ? this.mergeCurrentEdgesWithSourceMatches(
          oc,
          parsed.objName,
          entry,
          faceDir,
          parsed,
          consumedMatches,
        )
      : [];
  }

  // Returns a gp_Ax2 coordinate system for placement on a face.
  /**
   * Resolves axis against the current shape and its topology labels.
   */
  resolveAxis(oc: OC, placement: IRPlacement): unknown /* gp_Ax2 */ {
    const parsed = parseFaceRef(placement.faceRef);
    const entry = this.getEntry(parsed.objName);
    const base = this.resolveAxisBase(oc, placement, parsed, entry);
    if (!base.applyTransforms || !base.entry || !base.faceDir) return base.ax2;
    return this.applyAxisPlacementTransforms(oc, base, placement);
  }

  /**
   * Resolves axis base against the current shape and its topology labels.
   */
  private resolveAxisBase(
    oc: OC,
    placement: IRPlacement,
    parsed: ParsedFaceRef,
    entry: ShapeEntry | undefined,
  ): AxisBaseResolution {
    /**
     * Returns the default axis used by this module.
     */
    const defaultAxis = (): AxisBaseResolution => ({
      ax2: makeDefaultAxis(oc),
      entry: null,
      faceDir: null,
      parsed,
      applyTransforms: false,
    });
    if (!entry) return defaultAxis();
    if (parsed.curved) {
      return {
        ax2: getCylindricalSurfaceCoordSystem(
          oc,
          entry,
          placement.surfaceAngleDeg ?? placement.angleDeg ?? 0,
        ),
        entry,
        faceDir: null,
        parsed,
        applyTransforms: false,
      };
    }
    if (parsed.namedFace) {
      return this.resolveNamedFaceAxis(oc, entry, parsed) ?? defaultAxis();
    }
    if (!parsed.face) return defaultAxis();
    return this.resolveDirectionalFaceAxis(oc, entry, parsed);
  }

  /**
   * Resolves named face axis against the current shape and its topology labels.
   */
  private resolveNamedFaceAxis(
    oc: OC,
    entry: ShapeEntry,
    parsed: ParsedFaceRef,
  ): AxisBaseResolution | null {
    const face = selectFaceByPredicate(
      oc,
      entry,
      parsed.namedFace!,
      parsed.namedFaceFilters,
    );
    if (!face) return null;
    return {
      ax2: getPredicateFaceCoordSystem(oc, face),
      entry,
      faceDir: null,
      parsed,
      applyTransforms: false,
    };
  }

  /**
   * Resolves directional face axis against the current shape and its topology labels.
   */
  private resolveDirectionalFaceAxis(
    oc: OC,
    entry: ShapeEntry,
    parsed: ParsedFaceRef,
  ): AxisBaseResolution {
    const faceDir = parsed.face!;
    const qualifier = effectiveFaceQualifier(entry, parsed);
    const matched = filterFacesToRegion(
      matchFaces(entry, faceDir, qualifier),
      entry.regionBounds,
      entry.regionTag,
      entry.regionName,
    );
    if (matched.length === 0 && !canUseShapeBoundaryAnchor(entry, parsed)) {
      return {
        ax2: makeDefaultAxis(oc),
        entry: null,
        faceDir: null,
        parsed,
        applyTransforms: false,
      };
    }

    const ax2 =
      matched.length > 0
        ? getFaceCoordSystem(oc, entry, matched[0].face, {
            ...parsed,
            qualifier,
          })
        : getShapeBoundaryCoordSystem(oc, entry, faceDir, parsed);
    return { ax2, entry, faceDir, parsed, applyTransforms: true };
  }

  /**
   * Applies axis placement transforms to the supplied state or geometry.
   */
  private applyAxisPlacementTransforms(
    oc: OC,
    base: AxisBaseResolution,
    placement: IRPlacement,
  ): unknown {
    const { entry, faceDir } = base;
    if (!entry || !faceDir) return base.ax2;
    let ax2 = applyPlanarPlacementOffset(oc, base, placement);
    ax2 = applyNormalPlacementOffset(oc, ax2, placement);
    ax2 = applyNormalPlacementRotation(oc, ax2, placement);
    ax2 = applyLocalAxisPlacementRotation(oc, ax2, placement);
    ax2 = applyPlacementAnchorTransform(oc, ax2, placement);
    return ax2;
  }

  // Returns world-space { origin, axis } for a face ref string.
  // Used by joint resolution to derive pivot points and rotation axes.
  /**
   * Resolves joint axis raw against the current shape and its topology labels.
   */
  resolveJointAxisRaw(
    oc: OC,
    ref: string,
  ): { origin: Vec3; axis: Vec3 } | null {
    try {
      const placement: IRPlacement = { faceRef: ref };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ax2 = this.resolveAxis(oc, placement) as any;
      const loc = ax2.Location();
      const dir = ax2.Direction();
      const origin: Vec3 = [loc.X(), loc.Y(), loc.Z()];
      const axis: Vec3 = [dir.X(), dir.Y(), dir.Z()];
      try {
        loc.delete();
      } catch {
        /* ignore */
      }
      try {
        dir.delete();
      } catch {
        /* ignore */
      }
      try {
        ax2.delete();
      } catch {
        /* ignore */
      }
      return { origin, axis };
    } catch {
      return null;
    }
  }

  /**
   * Returns entry from the supplied input.
   */
  private getEntry(name: string): ShapeEntry | undefined {
    return this.map.get(name) ?? this.fallback?.getEntry(name);
  }

  /**
   * Handles filter consumed source matches in the topology flow.
   */
  private filterConsumedSourceMatches(
    oc: OC,
    objName: string,
    entry: ShapeEntry,
    faceDir: FaceDir,
    edges: unknown[],
  ): unknown[] {
    if (faceDir !== 'top' && faceDir !== 'bottom') return edges;
    const blockers = findPerpendicularFeatureBlockers(
      this.map,
      objName,
      entry,
      faceDir,
    ).concat(findAttachmentPlaneFeatureBlockers(this.map, objName, entry));
    if (blockers.length === 0) return edges;
    return edges.filter(
      (edge) =>
        !safeEdgeTest(() => edgeMidpointIsInsideAnyRegion(oc, edge, blockers)),
    );
  }

  /**
   * Handles merge current edges with source matches in the topology flow.
   */
  private mergeCurrentEdgesWithSourceMatches(
    oc: OC,
    objName: string,
    entry: ShapeEntry,
    faceDir: FaceDir,
    parsed: ParsedFaceRef,
    sourceMatches: unknown[],
  ): unknown[] {
    const filteredSource = this.filterConsumedSourceMatches(
      oc,
      objName,
      entry,
      faceDir,
      sourceMatches,
    );
    const current =
      parsed.subRef === 'edges'
        ? resolveCurrentFaceEdges(oc, entry, faceDir, parsed)
        : resolveCurrentEdges(oc, entry, faceDir, parsed);
    return this.filterConsumedSourceMatches(
      oc,
      objName,
      entry,
      faceDir,
      uniqueEdges([...filteredSource, ...current]),
    );
  }
}

// Face classification

/**
 * Applies planar placement offset to the supplied state or geometry.
 */
function applyPlanarPlacementOffset(
  oc: OC,
  base: AxisBaseResolution,
  placement: IRPlacement,
): unknown {
  const { entry, faceDir, parsed } = base;
  if (!entry || !faceDir) return base.ax2;
  const { dx, dy } = planarPlacementOffset(placement);
  return dx !== 0 || dy !== 0
    ? translateAxis(oc, base.ax2, faceDir, parsed, dx, dy, entry.frame)
    : base.ax2;
}

/**
 * Handles planar placement offset in the topology flow.
 */
function planarPlacementOffset(placement: IRPlacement): {
  dx: number;
  dy: number;
} {
  let dx = placement.offsetX ?? 0;
  let dy = placement.offsetY ?? 0;
  const radius = placement.radius ?? 0;
  if (radius !== 0) {
    const angleRad = ((placement.angleDeg ?? 0) * Math.PI) / 180;
    dx += radius * Math.cos(angleRad);
    dy += radius * Math.sin(angleRad);
  }
  return { dx, dy };
}

/**
 * Applies normal placement offset to the supplied state or geometry.
 */
function applyNormalPlacementOffset(
  oc: OC,
  ax2: unknown,
  placement: IRPlacement,
): unknown {
  return placement.offsetZ
    ? translateAxisAlongNormal(oc, ax2, placement.offsetZ)
    : ax2;
}

/**
 * Applies normal placement rotation to the supplied state or geometry.
 */
function applyNormalPlacementRotation(
  oc: OC,
  ax2: unknown,
  placement: IRPlacement,
): unknown {
  return placement.rotationDeg
    ? rotateAxisAroundNormal(oc, ax2, placement.rotationDeg)
    : ax2;
}

/**
 * Applies local axis placement rotation to the supplied state or geometry.
 */
function applyLocalAxisPlacementRotation(
  oc: OC,
  ax2: unknown,
  placement: IRPlacement,
): unknown {
  return placement.axisRotationDeg
    ? rotateAxisAroundLocalAxes(oc, ax2, placement.axisRotationDeg)
    : ax2;
}

/**
 * Applies placement anchor transform to the supplied state or geometry.
 */
function applyPlacementAnchorTransform(
  oc: OC,
  ax2: unknown,
  placement: IRPlacement,
): unknown {
  return placement.anchor
    ? applyPlacementAnchor(oc, ax2, placement.anchor)
    : ax2;
}

/**
 * Handles capture source shape entry in the topology flow.
 */
function captureSourceShapeEntry(
  oc: OC,
  shape: unknown,
  edgeMode: 'outer' | 'inner' | 'all',
  frame: FaceFrame,
  attachmentPlane?: SourceAttachmentPlane,
): SourceShapeEntry {
  return {
    shape,
    faces: classifyFaces(oc, shape, frame),
    edgeMode,
    frame,
    localBounds: getBounds(oc, shape, frame),
    ...(attachmentPlane ? { attachmentPlane } : {}),
  };
}

/**
 * Resolves source edges against the current shape and its topology labels.
 */
function resolveSourceEdges(
  oc: OC,
  entry: ShapeEntry,
  faceDir: FaceDir,
  parsed: ParsedFaceRef,
): unknown[] {
  if (!entry.source) return [];
  const sourceEntry: ShapeEntry = {
    shape: entry.source.shape,
    faces: entry.source.faces,
    edgeMode: entry.source.edgeMode,
    frame: entry.source.frame,
    regionLocalBounds: entry.source.localBounds,
  };
  const faces = matchFaces(sourceEntry, faceDir, parsed.qualifier);
  return resolveEdgesFromFaces(oc, sourceEntry, faces, faceDir, parsed);
}

/**
 * Resolves whole shape edges against the current shape and its topology labels.
 */
function resolveWholeShapeEdges(
  oc: OC,
  entry: ShapeEntry,
  parsed: ParsedFaceRef,
  inferBareEdges: boolean,
): unknown[] {
  const sourcePerimeterEdges = entry.source
    ? matchSourceEdgesInCurrentShape(
        oc,
        entry,
        wholeShapePerimeterEdges(oc, entry.source),
      )
    : undefined;
  return selectWholeShapeEdges({
    subRef: parsed.subRef,
    inferBareEdges,
    shapeEdges: getEdges(oc, entry.shape),
    faces: entry.faces,
    perimeterEdgesForFace: (face) =>
      getSampledFacePerimeterEdges(oc, [face], face.dir, entry.frame),
    sourcePerimeterEdges,
  });
}

/**
 * Handles whole shape perimeter edges in the topology flow.
 */
function wholeShapePerimeterEdges(oc: OC, entry: SourceShapeEntry): unknown[] {
  return selectWholeShapeEdges({
    subRef: 'perimeter',
    inferBareEdges: false,
    shapeEdges: [],
    faces: entry.faces,
    perimeterEdgesForFace: (face) =>
      getSampledFacePerimeterEdges(oc, [face], face.dir, entry.frame),
  });
}

/**
 * Resolves current edges against the current shape and its topology labels.
 */
function resolveCurrentEdges(
  oc: OC,
  entry: ShapeEntry,
  faceDir: FaceDir,
  parsed: ParsedFaceRef,
): unknown[] {
  const faces = filterFacesToRegion(
    matchFaces(entry, faceDir, parsed.qualifier),
    entry.regionBounds,
    entry.regionTag,
    entry.regionName,
  );
  return resolveEdgesFromFaces(oc, entry, faces, faceDir, parsed);
}

/**
 * Resolves current face edges against the current shape and its topology labels.
 */
function resolveCurrentFaceEdges(
  oc: OC,
  entry: ShapeEntry,
  faceDir: FaceDir,
  parsed: ParsedFaceRef,
): unknown[] {
  const faces = filterFacesToRegion(
    matchFaces(entry, faceDir, parsed.qualifier),
    entry.regionBounds,
    entry.regionTag,
    entry.regionName,
  );
  return filterEdgesToFaceBoundary(
    oc,
    entry,
    faceDir,
    filterEdgesToRegion(
      oc,
      uniqueEdges(faces.flatMap((f) => getEdges(oc, f.face))),
      entry.regionName,
      entry.regionBounds,
    ),
  );
}

/**
 * Handles filter edges to face boundary in the topology flow.
 */
function filterEdgesToFaceBoundary(
  oc: OC,
  entry: ShapeEntry,
  faceDir: FaceDir,
  edges: unknown[],
): unknown[] {
  const bounds = entry.regionLocalBounds;
  if (!bounds || (faceDir !== 'top' && faceDir !== 'bottom')) return edges;
  const plane = faceDir === 'top' ? bounds.zMax.current : bounds.zMin.current;
  const filtered = edges.filter((edge) =>
    safeEdgeTest(() => edgeLiesOnLocalPlane(oc, edge, entry.frame, 2, plane)),
  );
  return filtered.length > 0 ? filtered : edges;
}

/**
 * Keeps merged source-memory edges on the requested face plane.
 * A parent selector such as `base.top.edges` should include current top-plane
 * hole rims, but not lower pocket-floor rims that also have upward normals.
 */
function edgeLiesOnLocalPlane(
  oc: OC,
  edge: unknown,
  frame: FaceFrame,
  axis: Axis,
  value: number,
): boolean {
  const [first, last] = readEdgeEndpoints(oc, edge).map((point) =>
    toLocalPoint(point, frame),
  ) as [Vec3, Vec3];
  return near(first[axis], value) && near(last[axis], value);
}

/**
 * Resolves edges from faces against the current shape and its topology labels.
 */
function resolveEdgesFromFaces(
  oc: OC,
  entry: ShapeEntry,
  faces: FaceEntry[],
  faceDir: FaceDir,
  parsed: ParsedFaceRef,
): unknown[] {
  const faceEdges = faceEdgesForRegion(oc, entry, faces);
  if (parsed.subRef === 'edge') {
    return resolveNamedFaceEdges(oc, entry, faces, faceDir, parsed, faceEdges);
  }
  if (parsed.subRef === 'perimeter') {
    return resolvePerimeterEdges(oc, entry, faces, faceDir, parsed);
  }
  if (entry.edgeMode === 'inner') {
    return resolveInnerModeEdges(oc, entry, faceDir, parsed, faceEdges);
  }
  if (entry.edgeMode === 'outer') {
    return selectOuterFaceEdges(parsed, faceEdges, () =>
      getOuterFaceEdges(oc, entry, faces, faceDir, parsed.qualifier ?? 'outer'),
    );
  }
  return faceEdges;
}

/**
 * Resolves the face data required by the current selector.
 */
function faceEdgesForRegion(
  oc: OC,
  entry: ShapeEntry,
  faces: FaceEntry[],
): unknown[] {
  return filterEdgesToRegion(
    oc,
    uniqueEdges(faces.flatMap((f) => getEdges(oc, f.face))),
    entry.regionName,
    entry.regionBounds,
  );
}

/**
 * Resolves named face edges against the current shape and its topology labels.
 */
function resolveNamedFaceEdges(
  oc: OC,
  entry: ShapeEntry,
  faces: FaceEntry[],
  faceDir: FaceDir,
  parsed: ParsedFaceRef,
  faceEdges: unknown[],
): unknown[] {
  const namedEdges = getNamedFaceEdges(
    oc,
    faces,
    faceDir,
    parsed.edgeArg,
    entry.frame,
  );
  return namedEdges.length > 0 ? namedEdges : faceEdges;
}

/**
 * Resolves perimeter edges against the current shape and its topology labels.
 */
function resolvePerimeterEdges(
  oc: OC,
  entry: ShapeEntry,
  faces: FaceEntry[],
  faceDir: FaceDir,
  parsed: ParsedFaceRef,
): unknown[] {
  if (entry.edgeMode === 'inner') {
    return getInnerCutPerimeterEdges(oc, entry, faceDir);
  }
  const facePerimeterEdges = getSampledFacePerimeterEdges(
    oc,
    faces,
    faceDir,
    entry.frame,
  );
  if (facePerimeterEdges.length > 0) return facePerimeterEdges;
  const shapePerimeterEdges = getShapePerimeterEdges(
    oc,
    entry,
    faceDir,
    parsed.qualifier ?? 'outer',
  );
  if (shapePerimeterEdges.length > 0) return shapePerimeterEdges;
  return shapePerimeterFallbackEdges(oc, entry, faces, faceDir);
}

/**
 * Returns the shape data required by the current operation.
 */
function shapePerimeterFallbackEdges(
  oc: OC,
  entry: ShapeEntry,
  faces: FaceEntry[],
  faceDir: FaceDir,
): unknown[] {
  const shapeBounds = getBounds(oc, entry.shape, entry.frame);
  const candidateEdges = uniqueEdges(
    faces.flatMap((f) => getEdges(oc, f.face)),
  );
  if (candidateEdges.length === 0) return [];
  const outerEdges = uniqueEdges(
    candidateEdges.filter((edge) =>
      safeEdgeTest(() =>
        isShapePerimeterEdge(oc, edge, shapeBounds, faceDir, entry.frame),
      ),
    ),
  );
  return outerEdges.length > 0 ? outerEdges : [];
}

/**
 * Resolves inner mode edges against the current shape and its topology labels.
 */
function resolveInnerModeEdges(
  oc: OC,
  entry: ShapeEntry,
  faceDir: FaceDir,
  parsed: ParsedFaceRef,
  faceEdges: unknown[],
): unknown[] {
  const regionPlaneEdges = getInnerCutRegionPlaneEdges(
    oc,
    entry,
    faceDir,
    parsed,
  );
  if (regionPlaneEdges.length > 0) return regionPlaneEdges;
  const scopedEdges =
    faceEdges.length > 0
      ? faceEdges
      : getCutRegionPlaneEdges(oc, entry, faceDir);
  const candidateEdges = innerModeCandidateEdges(
    oc,
    entry,
    faceDir,
    scopedEdges,
  );
  if (faceDir === 'bottom') {
    return candidateEdges.length > 0 ? candidateEdges : scopedEdges;
  }
  return preferredInnerModeEdges(
    oc,
    entry,
    faceDir,
    scopedEdges,
    candidateEdges,
  );
}

/**
 * Handles inner mode candidate edges in the topology flow.
 */
function innerModeCandidateEdges(
  oc: OC,
  entry: ShapeEntry,
  faceDir: FaceDir,
  scopedEdges: unknown[],
): unknown[] {
  const planeEdges = getInnerFacePlaneEdges(oc, entry, faceDir, scopedEdges);
  return planeEdges.length > 0
    ? planeEdges
    : filterEdgesToExtremeLocalPlane(oc, entry, faceDir, scopedEdges);
}

/**
 * Handles preferred inner mode edges in the topology flow.
 */
function preferredInnerModeEdges(
  oc: OC,
  entry: ShapeEntry,
  faceDir: FaceDir,
  scopedEdges: unknown[],
  candidateEdges: unknown[],
): unknown[] {
  const interiorEdges = getInteriorFaceEdges(
    oc,
    entry,
    candidateEdges.length > 0 ? candidateEdges : scopedEdges,
    faceDir,
  );
  return interiorEdges.length > 0
    ? interiorEdges
    : candidateEdges.length > 0
      ? candidateEdges
      : scopedEdges;
}

/**
 * Returns sampled face perimeter edges from the supplied input.
 */
function getSampledFacePerimeterEdges(
  oc: OC,
  faces: FaceEntry[],
  dir: FaceDir,
  frame: FaceFrame,
): unknown[] {
  return uniqueEdges(
    faces.flatMap((face) =>
      selectSampledOuterLoopEdges(
        getEdges(oc, face.face).map((edge) => ({
          edge,
          points: sampleEdge(oc, edge).map((point) =>
            facePlaneCoords(point, dir, frame),
          ),
        })),
      ),
    ),
  );
}

/**
 * Resolves top/bottom edge selectors from the cutter region plane.
 * Cut aliases are scoped by the cutter region, not by whichever faces OCCT
 * classifies after the boolean. Lofted cuts can expose split or sloped faces,
 * so `bottom.edges` must anchor to the registered lower plane.
 */
function getInnerCutRegionPlaneEdges(
  oc: OC,
  entry: ShapeEntry,
  faceDir: FaceDir,
  parsed: ParsedFaceRef,
): unknown[] {
  if (
    (parsed.subRef !== undefined && parsed.subRef !== 'edges') ||
    (faceDir !== 'top' && faceDir !== 'bottom')
  ) {
    return [];
  }
  const edges = getCutRegionPlaneEdges(oc, entry, faceDir);
  if (entry.regionToolKind === 'loft' && faceDir === 'bottom') {
    return selectLoftCutBottomBoundaryLoops(oc, entry, edges);
  }
  return edges;
}

/**
 * Handles match source edges in current shape in the topology flow.
 */
function matchSourceEdgesInCurrentShape(
  oc: OC,
  entry: ShapeEntry,
  sourceEdges: unknown[],
): unknown[] {
  const currentEdges = getEdges(oc, entry.shape);
  const matched = currentEdges.filter((candidate) =>
    sourceEdges.some(
      (seed) =>
        sameShape(candidate, seed) ||
        safeEdgeTest(() =>
          edgeOverlapsSourceSeed(oc, candidate, seed, entry.frame),
        ),
    ),
  );
  return uniqueEdges(matched);
}

/**
 * Resolves the edge data required by the current selector.
 */
function edgeOverlapsSourceSeed(
  oc: OC,
  candidate: unknown,
  seed: unknown,
  frame: FaceFrame,
): boolean {
  const [seedFirst, seedLast] = readEdgeEndpoints(oc, seed).map((point) =>
    toLocalPoint(point, frame),
  ) as [Vec3, Vec3];
  const [candidateFirst, candidateLast] = readEdgeEndpoints(oc, candidate).map(
    (point) => toLocalPoint(point, frame),
  ) as [Vec3, Vec3];
  const seedDir = normalizeVec(subtractVec(seedLast, seedFirst));
  const candidateDir = normalizeVec(subtractVec(candidateLast, candidateFirst));
  if (!seedDir || !candidateDir) {
    return edgeBoundsOverlap(oc, candidate, seed, frame);
  }
  if (Math.abs(dot(seedDir, candidateDir)) < 0.985) return false;
  if (
    distanceFromLine(candidateFirst, seedFirst, seedDir) > 0.25 ||
    distanceFromLine(candidateLast, seedFirst, seedDir) > 0.25
  ) {
    return false;
  }
  const seedRange = projectionRange(seedFirst, seedLast, seedFirst, seedDir);
  const candidateRange = projectionRange(
    candidateFirst,
    candidateLast,
    seedFirst,
    seedDir,
  );
  return rangesOverlap(seedRange, candidateRange, 0.25);
}

/**
 * Resolves the edge data required by the current selector.
 */
function edgeBoundsOverlap(
  oc: OC,
  candidate: unknown,
  seed: unknown,
  frame: FaceFrame,
): boolean {
  const seedBounds = getBounds(oc, seed, frame);
  const candidateBounds = getBounds(oc, candidate, frame);
  const seedCenter = boundsCenter(seedBounds);
  const candidateCenter = boundsCenter(candidateBounds);
  return (
    distanceVec(seedCenter, candidateCenter) <= 0.25 &&
    boundsSizeDifference(seedBounds, candidateBounds) <= 0.5
  );
}

/**
 * Finds smaller fused features that consume a source face boundary.
 * A parent selector such as `base.top.edges` should keep the original source
 * edge intent, but the portion hidden by a perpendicular child feature is no
 * longer available for that parent blend. The child can still select that seam
 * through its own bottom edge selector.
 */
function findPerpendicularFeatureBlockers(
  entries: Map<string, ShapeEntry>,
  objName: string,
  entry: ShapeEntry,
  faceDir: 'top' | 'bottom',
): Bounds[] {
  const sourceBounds = entry.regionBounds;
  if (!sourceBounds) return [];
  const sourceArea = xyArea(sourceBounds);
  if (sourceArea <= 1e-9) return [];
  const sourceZ =
    faceDir === 'top' ? sourceBounds.zMax.current : sourceBounds.zMin.current;
  return smallerFeatureBounds(entries, objName, sourceArea).filter((bounds) =>
    faceDir === 'top'
      ? Math.abs(bounds.zMin.current - sourceZ) <= 0.05 &&
        bounds.zMax.current > sourceZ + 0.05
      : Math.abs(bounds.zMax.current - sourceZ) <= 0.05 &&
        bounds.zMin.current < sourceZ - 0.05,
  );
}

/**
 * Finds sibling features that interrupt a placed additive seam.
 * A selector such as `flange.bottom.edges` should recover only the flange/base
 * shoulder. If a boss also crosses the same attachment plane, its contact seam
 * can geometrically match the projected flange source edge; it remains
 * selectable through `boss.bottom.edges`, but is not part of the flange target.
 */
function findAttachmentPlaneFeatureBlockers(
  entries: Map<string, ShapeEntry>,
  objName: string,
  entry: ShapeEntry,
): Bounds[] {
  const sourceBounds = entry.regionBounds;
  const plane = entry.source?.attachmentPlane;
  if (!sourceBounds || !plane) return [];
  const sourceArea = xyArea(sourceBounds);
  if (sourceArea <= 1e-9) return [];
  const planeZ = dot(plane.origin, entry.frame.z);
  return smallerFeatureBounds(entries, objName, sourceArea)
    .filter((bounds) => boundsOverlapXY(sourceBounds, bounds, 0.05))
    .filter((bounds) => boundsTouchesLocalZPlane(bounds, planeZ, 0.05));
}

/**
 * Handles smaller feature bounds in the topology flow.
 */
function smallerFeatureBounds(
  entries: Map<string, ShapeEntry>,
  objName: string,
  sourceArea: number,
): Bounds[] {
  return [...entries.entries()]
    .filter(([name]) => name !== objName)
    .map(([, other]) => other.regionBounds)
    .filter((bounds): bounds is Bounds => bounds !== undefined)
    .filter((bounds) => xyArea(bounds) < sourceArea * 0.98);
}

/**
 * Resolves the edge data required by the current selector.
 */
function edgeMidpointIsInsideAnyRegion(
  oc: OC,
  edge: unknown,
  regions: Bounds[],
): boolean {
  const midpoint = edgeMidpoint(oc, edge);
  return regions.some((bounds) => pointWithinRegionXY(midpoint, bounds, 0.05));
}

/**
 * Handles xy area in the topology flow.
 */
function xyArea(bounds: Bounds): number {
  return (
    Math.max(0, bounds.xMax.current - bounds.xMin.current) *
    Math.max(0, bounds.yMax.current - bounds.yMin.current)
  );
}

/**
 * Calculates the bounds of the supplied geometry.
 */
function boundsOverlapXY(a: Bounds, b: Bounds, tol = 0): boolean {
  return (
    a.xMin.current <= b.xMax.current + tol &&
    a.xMax.current >= b.xMin.current - tol &&
    a.yMin.current <= b.yMax.current + tol &&
    a.yMax.current >= b.yMin.current - tol
  );
}

/**
 * Calculates the bounds of the supplied geometry.
 */
function boundsTouchesLocalZPlane(bounds: Bounds, z: number, tol = 0): boolean {
  return bounds.zMin.current <= z + tol && bounds.zMax.current >= z - tol;
}

/**
 * Classifies faces against either the whole shape or a source alias region.
 * Fused parts register source names against the same running solid, but
 * `boss.top` must be classified relative to the boss's own extents rather than
 * the much larger fused part bounds.
 */
function classifyFaces(
  oc: OC,
  shape: unknown,
  frame: FaceFrame,
  regionShape?: unknown,
): FaceEntry[] {
  const faces: FaceEntry[] = [];
  const shapeCenter = boundsCenter(getBounds(oc, regionShape ?? shape, frame));
  const exp = new oc.TopExp_Explorer_2(
    shape,
    oc.TopAbs_ShapeEnum.TopAbs_FACE,
    oc.TopAbs_ShapeEnum.TopAbs_SHAPE,
  );
  for (; exp.More(); exp.Next()) {
    const face = oc.TopoDS.Face_1(exp.Current());
    const normal = getFaceNormal(oc, face);
    const center = getFaceCenterCoords(oc, face);
    if (normal && center) {
      const localCenter = toLocalPoint(center, frame);
      const localNormal = toLocalVector(normal, frame);
      const fallbackDir = normalToDir(localNormal);
      const qualifier = faceQualifier(localNormal, localCenter, shapeCenter);
      faces.push({
        dir:
          qualifier === 'outer' &&
          (fallbackDir === 'top' || fallbackDir === 'bottom')
            ? fallbackDir
            : positionToDir(localCenter, shapeCenter, fallbackDir),
        qualifier,
        face,
        center,
        localCenter,
      });
    }
  }
  exp.delete();
  return faces;
}

// Face predicate selection

/**
 * Returns face area from the supplied input.
 */
function getFaceArea(oc: OC, face: unknown): number {
  try {
    const gprops = new oc.GProp_GProps_1();
    oc.BRepGProp.SurfaceProperties_1(face, gprops, false, false);
    const area = gprops.Mass();
    gprops.delete();
    return area;
  } catch {
    return 0;
  }
}

/**
 * Returns whether the input meets the `face planar` condition.
 */
function isFacePlanar(oc: OC, face: unknown): boolean {
  try {
    const adaptor = new oc.BRepAdaptor_Surface_2(face, true);
    const type = adaptor.GetType();
    adaptor.delete();
    return type === oc.GeomAbs_SurfaceType.GeomAbs_Plane;
  } catch {
    return false;
  }
}

/**
 * Returns whether the input meets the `face cylindrical` condition.
 */
function isFaceCylindrical(oc: OC, face: unknown): boolean {
  try {
    const adaptor = new oc.BRepAdaptor_Surface_2(face, true);
    const type = adaptor.GetType();
    adaptor.delete();
    return type === oc.GeomAbs_SurfaceType.GeomAbs_Cylinder;
  } catch {
    return false;
  }
}

/**
 * Handles normal matches filter in the topology flow.
 */
function normalMatchesFilter(
  normal: Vec3,
  filters: { name: string; value: string }[],
): boolean {
  for (const { name, value } of filters) {
    if (name === 'normal') {
      const target = parseAxisFilter(value);
      if (target) {
        const d = dot(normal, target);
        if (d < COS45) return false;
      }
    }
  }
  return true;
}

/**
 * Parses axis filter from the supplied source into the topology representation.
 */
function parseAxisFilter(value: string): Vec3 | null {
  const sign = value.startsWith('-') ? -1 : 1;
  const axis = value.replace(/^[+-]/, '').toUpperCase();
  if (axis === 'X') return [sign, 0, 0];
  if (axis === 'Y') return [0, sign, 0];
  if (axis === 'Z') return [0, 0, sign];
  return null;
}

/**
 * Selects face by predicate according to the supplied filters.
 */
function selectFaceByPredicate(
  oc: OC,
  entry: ShapeEntry,
  predicate: string,
  filters?: { name: string; value: string }[],
): unknown | null {
  const mode = facePredicateMode(predicate);
  let bestFace: unknown | null = null;
  let bestArea = mode.wantLargest ? -1 : Infinity;

  const exp = new oc.TopExp_Explorer_2(
    entry.shape,
    oc.TopAbs_ShapeEnum.TopAbs_FACE,
    oc.TopAbs_ShapeEnum.TopAbs_SHAPE,
  );
  for (; exp.More(); exp.Next()) {
    const face = oc.TopoDS.Face_1(exp.Current());
    if (!faceMatchesPredicate(oc, face, mode, filters)) continue;
    const area = getFaceArea(oc, face);
    if (isBetterPredicateFace(area, bestArea, mode)) {
      bestFace = face;
      bestArea = area;
    }
  }
  exp.delete();
  return bestFace;
}

/**
 * Resolves the face data required by the current selector.
 */
function facePredicateMode(predicate: string): FacePredicateMode {
  return {
    wantPlanar:
      predicate === 'largest_planar' || predicate === 'smallest_planar',
    wantCylindrical: predicate === 'cylindrical',
    wantLargest: predicate === 'largest_planar',
  };
}

/**
 * Resolves the face data required by the current selector.
 */
function faceMatchesPredicate(
  oc: OC,
  face: unknown,
  mode: FacePredicateMode,
  filters?: { name: string; value: string }[],
): boolean {
  if (mode.wantPlanar && !isFacePlanar(oc, face)) return false;
  if (mode.wantCylindrical && !isFaceCylindrical(oc, face)) return false;
  return faceMatchesFilters(oc, face, filters);
}

/**
 * Resolves the face data required by the current selector.
 */
function faceMatchesFilters(
  oc: OC,
  face: unknown,
  filters?: { name: string; value: string }[],
): boolean {
  if (!filters || filters.length === 0) return true;
  const normal = getFaceNormal(oc, face);
  return normal ? normalMatchesFilter(normal, filters) : false;
}

/**
 * Returns whether the input meets the `better predicate face` condition.
 */
function isBetterPredicateFace(
  area: number,
  bestArea: number,
  mode: FacePredicateMode,
): boolean {
  return mode.wantLargest ? area > bestArea : area < bestArea;
}

/**
 * Returns predicate face coord system from the supplied input.
 */
function getPredicateFaceCoordSystem(
  oc: OC,
  face: unknown,
): unknown /* gp_Ax2 */ {
  const normal = getFaceNormal(oc, face) ?? ([0, 0, 1] as Vec3);
  const center = getFaceCenterPoint(oc, face);
  const normalDir: Vec3 = [normal[0], normal[1], normal[2]];
  const xVec =
    normalizeVec(
      cross(
        normalDir,
        Math.abs(normalDir[2]) < 0.9
          ? ([0, 0, 1] as Vec3)
          : ([1, 0, 0] as Vec3),
      ),
    ) ?? ([1, 0, 0] as Vec3);
  const zDir = new oc.gp_Dir_4(normalDir[0], normalDir[1], normalDir[2]);
  const xDir = new oc.gp_Dir_4(xVec[0], xVec[1], xVec[2]);
  const ax2 = new oc.gp_Ax2_2(center, zDir, xDir);
  zDir.delete();
  xDir.delete();
  return ax2;
}

/**
 * Handles match faces in the topology flow.
 */
function matchFaces(
  entry: ShapeEntry,
  dir: FaceDir,
  qualifier?: 'inner' | 'outer',
): FaceEntry[] {
  const wanted = qualifier ?? 'outer';
  const exact = entry.faces.filter(
    (f) => f.dir === dir && f.qualifier === wanted,
  );
  if (exact.length <= 1 || qualifier !== 'inner') {
    if (exact.length > 0 || qualifier) return exact;
    return entry.faces.filter((f) => f.dir === dir);
  }
  // Multiple inner faces matched — pick the one spatially closest to the wall.
  // This disambiguates the true shell inner wall from spurious tunnel side-faces.
  const best = exact.reduce((a, b) =>
    wallProximityScore(a.localCenter, dir) >
    wallProximityScore(b.localCenter, dir)
      ? a
      : b,
  );
  return [best];
}

/**
 * Chooses the implicit face qualifier for placement refs.
 * Cut aliases are registered with inner edge mode. An unqualified selector like
 * `pocket.bottom` should therefore resolve to the pocket floor, not the owning
 * part's outside bottom, and its axis must point into that inner region.
 */
function effectiveFaceQualifier(
  entry: ShapeEntry,
  ref: ParsedFaceRef,
): 'inner' | 'outer' | undefined {
  return ref.qualifier ?? (entry.edgeMode === 'inner' ? 'inner' : undefined);
}

/**
 * Narrows fused part faces to the source object region that registered an alias.
 * M39 aliases point at the fused part solid, but selectors such as
 * `base.top.edges` must still mean the surviving top faces inside the original
 * base feature, not every top face introduced later by bosses or flanges.
 */
function filterFacesToRegion(
  faces: FaceEntry[],
  regionBounds: Bounds | undefined,
  regionTag: unknown,
  regionName: string | undefined,
): FaceEntry[] {
  if (!regionBounds) return faces;
  const filtered = faces.filter((face) => {
    const sourceName = (face.face as { _sourceName?: string })?._sourceName;
    if (sourceName !== undefined && regionName !== undefined) {
      return sourceName === regionName;
    }
    const mockRegion = (face.face as { _region?: string })?._region;
    if (mockRegion !== undefined) {
      return mockRegion === (regionTag ?? regionName);
    }
    return pointInBounds(face.center, regionBounds, 1e-3);
  });
  if (filtered.length > 0) return filtered;
  return faces.filter((face) =>
    faceTouchesBounds(face.center, regionBounds, 1e-3),
  );
}

/**
 * Handles filter edges to region in the topology flow.
 */
function filterEdgesToRegion(
  oc: OC,
  edges: unknown[],
  regionName: string | undefined,
  regionBounds: Bounds | undefined,
): unknown[] {
  const filtered = edges.filter((edge) => {
    const sourceName = (edge as { _sourceName?: string })?._sourceName;
    if (
      sourceName !== undefined &&
      regionName !== undefined &&
      sourceName !== regionName
    ) {
      return false;
    }
    return (
      !regionBounds ||
      safeEdgeTest(() => edgeMidpointWithinBounds(oc, edge, regionBounds))
    );
  });
  return filtered.length > 0 ? filtered : edges;
}

/**
 * Resolves the edge data required by the current selector.
 */
function edgeMidpointWithinBounds(
  oc: OC,
  edge: unknown,
  bounds: Bounds,
): boolean {
  return pointInBounds(edgeMidpoint(oc, edge), bounds, BOUNDARY_TOLERANCE);
}

/**
 * Resolves the edge data required by the current selector.
 */
function edgeMidpoint(oc: OC, edge: unknown): Vec3 {
  const [first, last] = readEdgeEndpoints(oc, edge);
  return [
    (first[0] + last[0]) / 2,
    (first[1] + last[1]) / 2,
    (first[2] + last[2]) / 2,
  ];
}

/**
 * Creates point geometry from the supplied coordinates.
 */
function pointInBounds(
  point: Vec3,
  bounds: Bounds,
  tolerance: number,
): boolean {
  return (
    pointWithinRegionXY(point, bounds, tolerance) &&
    point[2] >= bounds.zMin.current - tolerance &&
    point[2] <= bounds.zMax.current + tolerance
  );
}

/**
 * Resolves the face data required by the current selector.
 */
function faceTouchesBounds(
  point: Vec3,
  bounds: Bounds,
  tolerance: number,
): boolean {
  return (
    pointWithinRegionXY(point, bounds, tolerance) &&
    point[2] >= bounds.zMin.current - tolerance
  );
}

/**
 * Creates point geometry from the supplied coordinates.
 */
function pointWithinRegionXY(
  point: Vec3,
  bounds: Bounds,
  tolerance: number,
): boolean {
  return (
    point[0] >= bounds.xMin.current - tolerance &&
    point[0] <= bounds.xMax.current + tolerance &&
    point[1] >= bounds.yMin.current - tolerance &&
    point[1] <= bounds.yMax.current + tolerance
  );
}

/**
 * Handles wall proximity score in the topology flow.
 */
function wallProximityScore(center: Vec3, dir: FaceDir): number {
  switch (dir) {
    case 'front':
      return -center[1];
    case 'back':
      return center[1];
    case 'left':
      return -center[0];
    case 'right':
      return center[0];
    case 'top':
      return center[2];
    case 'bottom':
      return -center[2];
  }
}

/**
 * Returns face normal from the supplied input.
 */
function getFaceNormal(oc: OC, face: unknown): Vec3 | null {
  try {
    const props = new oc.BRepGProp_Face_2(face, false);
    const uMin = { current: 0 },
      uMax = { current: 0 };
    const vMin = { current: 0 },
      vMax = { current: 0 };
    props.Bounds(uMin, uMax, vMin, vMax);
    const pnt = new oc.gp_Pnt_1();
    const normal = new oc.gp_Vec_1();
    props.Normal(
      (uMin.current + uMax.current) / 2,
      (vMin.current + vMax.current) / 2,
      pnt,
      normal,
    );
    const result: Vec3 = [normal.X(), normal.Y(), normal.Z()];
    pnt.delete();
    normal.delete();
    props.delete();
    return result;
  } catch {
    return null;
  }
}

/**
 * Handles normal to dir in the topology flow.
 */
function normalToDir(n: Vec3): FaceDir {
  const [nx, ny, nz] = n;
  if (nz > COS45) return 'top';
  if (nz < -COS45) return 'bottom';
  if (ny > COS45) return 'back';
  if (ny < -COS45) return 'front';
  if (nx > COS45) return 'right';
  return 'left';
}

// Classify a face's wall-side by spatial position rather than normal direction.
// Normal-based classification breaks for inner shell faces whose normals point
// inward (opposite to the wall direction), and for cut-tunnel faces that end up
// on the wrong side of the shape centroid.
/**
 * Handles position to dir in the topology flow.
 */
function positionToDir(
  center: Vec3,
  shapeCenter: Vec3,
  fallback: FaceDir,
): FaceDir {
  const dx = center[0] - shapeCenter[0];
  const dy = center[1] - shapeCenter[1];
  const dz = center[2] - shapeCenter[2];
  const ax = Math.abs(dx),
    ay = Math.abs(dy),
    az = Math.abs(dz);
  if (ax === ay && ay === az) return fallback;
  if (az >= ax && az >= ay) return dz >= 0 ? 'top' : 'bottom';
  if (ay >= ax) return dy >= 0 ? 'back' : 'front';
  return dx >= 0 ? 'right' : 'left';
}

// Face geometry helpers

/**
 * Returns face perimeter edges from the supplied input.
 */
function getFacePerimeterEdges(
  oc: OC,
  face: unknown,
  dir: FaceDir,
  frame: FaceFrame,
): unknown[] {
  const bounds = getBounds(oc, face, frame);
  return getEdges(oc, face).filter((edge) =>
    safeEdgeTest(() => isPerimeterEdge(oc, edge, bounds, dir, frame)),
  );
}

/**
 * Returns named face edges from the supplied input.
 */
function getNamedFaceEdges(
  oc: OC,
  faces: FaceEntry[],
  dir: FaceDir,
  edgeArg: string | undefined,
  frame: FaceFrame,
): unknown[] {
  if (!edgeArg) return [];
  return uniqueEdges(
    faces.flatMap((face) => {
      const bounds = getBounds(oc, face.face, frame);
      return getEdges(oc, face.face).filter((edge) =>
        safeEdgeTest(() =>
          isNamedFaceEdge(oc, edge, bounds, dir, edgeArg, frame),
        ),
      );
    }),
  );
}

/**
 * Returns shape perimeter edges from the supplied input.
 */
function getShapePerimeterEdges(
  oc: OC,
  entry: ShapeEntry,
  dir: FaceDir,
  qualifier: 'inner' | 'outer',
): unknown[] {
  if (qualifier === 'inner') return [];
  const bounds =
    entry.regionLocalBounds ?? getBounds(oc, entry.shape, entry.frame);
  return uniqueEdges(
    getEdges(oc, entry.shape).filter((edge) => {
      return safeEdgeTest(() =>
        isShapePerimeterEdge(oc, edge, bounds, dir, entry.frame),
      );
    }),
  );
}

/**
 * Returns outer face edges from the supplied input.
 */
function getOuterFaceEdges(
  oc: OC,
  entry: ShapeEntry,
  faces: FaceEntry[],
  dir: FaceDir,
  qualifier: 'inner' | 'outer',
): unknown[] {
  const shapePerimeterEdges = getShapePerimeterEdges(oc, entry, dir, qualifier);
  if (shapePerimeterEdges.length > 0) return shapePerimeterEdges;
  const facePerimeterEdges = uniqueEdges(
    faces.flatMap((f) => getFacePerimeterEdges(oc, f.face, dir, entry.frame)),
  );
  if (facePerimeterEdges.length > 0) return facePerimeterEdges;
  return [];
}

/**
 * Returns interior face edges from the supplied input.
 */
function getInteriorFaceEdges(
  oc: OC,
  entry: ShapeEntry,
  edges: unknown[],
  dir: FaceDir,
): unknown[] {
  if (edges.length === 0) return [];
  const bounds =
    entry.regionLocalBounds ?? getBounds(oc, entry.shape, entry.frame);
  return uniqueEdges(
    edges.filter(
      (edge) =>
        !safeEdgeTest(() =>
          isShapePerimeterEdge(oc, edge, bounds, dir, entry.frame),
        ),
    ),
  );
}

/**
 * Resolves the rim where an inner cut meets the requested top or bottom plane.
 * For cut aliases, `.perimeter` describes the cutter footprint rim, not the
 * perimeter of the parent part. Bottom refs also use this path so pocket-floor
 * bore edges do not get mixed into the floor wall rim.
 */
function getInnerCutPerimeterEdges(
  oc: OC,
  entry: ShapeEntry,
  dir: FaceDir,
): unknown[] {
  return getCutRegionPlaneCandidateEdges(oc, entry, dir, true);
}

/**
 * Returns cut region plane candidate edges from the supplied input.
 */
function getCutRegionPlaneCandidateEdges(
  oc: OC,
  entry: ShapeEntry,
  dir: FaceDir,
  requireRegionBoundary: boolean,
): unknown[] {
  const worldBounds = entry.regionBounds;
  const localBounds = entry.regionLocalBounds;
  if (!worldBounds || !localBounds || (dir !== 'top' && dir !== 'bottom')) {
    return [];
  }
  const plane =
    dir === 'top' ? localBounds.zMax.current : localBounds.zMin.current;
  return uniqueEdges(
    getEdges(oc, entry.shape).filter((edge) =>
      safeEdgeTest(
        () =>
          edgeLiesOnLocalPlane(oc, edge, entry.frame, 2, plane) &&
          edgeMidpointWithinBounds(oc, edge, worldBounds) &&
          (!requireRegionBoundary ||
            edgeTouchesCutRegionBoundary(oc, edge, entry.frame, localBounds)),
      ),
    ),
  );
}

/**
 * Drops internal closed cap loops from loft-cut bottom edge aliases.
 * OCCT can leave multiple concentric closed edges on a loft cutter's lower
 * cap. Blending both loops consumes the narrow cap band and lifts the apparent
 * floor toward the brim; `loft_cut.bottom.edges` should use the cutter-region
 * floor rim that actually bounds the generated pocket.
 */
function selectLoftCutBottomBoundaryLoops(
  oc: OC,
  entry: ShapeEntry,
  edges: unknown[],
): unknown[] {
  const wallEdges = getLoftCutBottomWallEdges(oc, entry);
  if (wallEdges.length > 0) return wallEdges;

  const interiorLoops = getLoftCutBottomInteriorLoops(oc, entry, edges);
  if (interiorLoops.length > 0) return interiorLoops;

  const sourceProfileMatches = getLoftCutBottomSourceProfileMatches(
    oc,
    entry,
    edges,
  );
  if (sourceProfileMatches.length > 0) return sourceProfileMatches;

  if (edges.filter((edge) => isClosedEdgeLoop(oc, edge)).length < 2) {
    return edges;
  }
  const boundaryEdges = getCutRegionPlaneCandidateEdges(
    oc,
    entry,
    'bottom',
    true,
  );
  return boundaryEdges.length > 0 ? boundaryEdges : edges;
}

/**
 * Selects edge handles from the loft wall where it meets the bottom floor.
 * OCCT can expose concentric bottom-plane loops from the cut cap. Those loops
 * are geometrically close to the desired rim, but filleting them behaves like
 * filling the cap. The edge handle from a side-wall face is the same identity
 * ordinary cut/extrude fillets use: the shared wall/floor corner.
 */
function getLoftCutBottomWallEdges(oc: OC, entry: ShapeEntry): unknown[] {
  const worldBounds = entry.regionBounds;
  const localBounds = entry.regionLocalBounds;
  if (!worldBounds || !localBounds) return [];
  const plane = localBounds.zMin.current;
  const wallFaces = filterFacesToRegion(
    entry.faces.filter((face) =>
      faceIsNotHorizontal(oc, face.face, entry.frame),
    ),
    worldBounds,
    entry.regionTag,
    entry.regionName,
  );
  return uniqueEdges(
    wallFaces.flatMap((face) =>
      getEdges(oc, face.face).filter((edge) =>
        safeEdgeTest(
          () =>
            edgeLiesOnLocalPlane(oc, edge, entry.frame, 2, plane) &&
            edgeMidpointWithinBounds(oc, edge, worldBounds),
        ),
      ),
    ),
  );
}

/**
 * Resolves the face data required by the current selector.
 */
function faceIsNotHorizontal(oc: OC, face: unknown, frame: FaceFrame): boolean {
  const normal = getFaceNormal(oc, face);
  if (!normal) return false;
  const local = toLocalVector(normal, frame);
  return Math.abs(local[2]) < COS45;
}

/**
 * Selects the visible floor loop inside a loft cut's lower cap.
 * Solid-cut placement can put the larger loft profile on the same plane as the
 * generated pocket floor. The larger loop touches the cutter-region boundary
 * and makes OCCT fill or lift the floor; the interior loop is the concave rim a
 * user expects from `loft_cut.bottom.edges`.
 */
function getLoftCutBottomInteriorLoops(
  oc: OC,
  entry: ShapeEntry,
  edges: unknown[],
): unknown[] {
  const localBounds = entry.regionLocalBounds;
  if (!localBounds) return [];
  return uniqueEdges(
    edges.filter(
      (edge) =>
        isClosedEdgeLoop(oc, edge) &&
        !safeEdgeTest(() =>
          edgeTouchesCutRegionBoundary(oc, edge, entry.frame, localBounds),
        ),
    ),
  );
}

/**
 * Matches loft-cut bottom candidates against the cutter's source profile.
 * A loft cut's axis-aligned bounds can also contain the host body's exterior
 * bottom edge. Matching the current boolean result back to the registered loft
 * tool's lower profile keeps `cut.bottom.edges` on the pocket floor rim instead
 * of selecting the outer body perimeter.
 */
function getLoftCutBottomSourceProfileMatches(
  oc: OC,
  entry: ShapeEntry,
  edges: unknown[],
): unknown[] {
  if (!entry.source || edges.length === 0) return [];
  const sourceProfileEdges = getLoftCutBottomSourceProfileEdges(oc, entry);
  if (sourceProfileEdges.length === 0) return [];
  return uniqueEdges(
    edges.filter((candidate) =>
      sourceProfileEdges.some((seed) =>
        safeEdgeTest(
          () =>
            edgeOverlapsSourceSeed(oc, candidate, seed, entry.frame) ||
            edgeBoundsOverlap(oc, candidate, seed, entry.frame),
        ),
      ),
    ),
  );
}

/**
 * Reads the lower profile edges from a registered loft cut tool.
 * The source shape is the placed cutter before the boolean. Its bottom profile
 * is the authoring geometry that should survive as the generated pocket-floor
 * selector after the cut.
 */
function getLoftCutBottomSourceProfileEdges(
  oc: OC,
  entry: ShapeEntry,
): unknown[] {
  if (!entry.source) return [];
  const sourceEntry: ShapeEntry = {
    shape: entry.source.shape,
    faces: entry.source.faces,
    edgeMode: entry.source.edgeMode,
    frame: entry.source.frame,
    regionLocalBounds: entry.source.localBounds,
  };
  const bottomFaces = matchFaces(sourceEntry, 'bottom');
  const plane = entry.source.localBounds.zMin.current;
  const faceEdges = uniqueEdges(
    bottomFaces.flatMap((f) => getEdges(oc, f.face)),
  );
  const profileEdges = faceEdges.filter((edge) =>
    safeEdgeTest(() =>
      edgeLiesOnLocalPlane(
        oc,
        edge,
        entry.source?.frame ?? entry.frame,
        2,
        plane,
      ),
    ),
  );
  if (profileEdges.length > 0) return profileEdges;
  return uniqueEdges(
    getEdges(oc, entry.source.shape).filter((edge) =>
      safeEdgeTest(() =>
        edgeLiesOnLocalPlane(
          oc,
          edge,
          entry.source?.frame ?? entry.frame,
          2,
          plane,
        ),
      ),
    ),
  );
}

/**
 * Returns whether the input meets the `closed edge loop` condition.
 */
function isClosedEdgeLoop(oc: OC, edge: unknown): boolean {
  return safeEdgeTest(() => {
    const [first, last] = readEdgeEndpoints(oc, edge);
    return (
      Math.abs(first[0] - last[0]) <= BOUNDARY_TOLERANCE &&
      Math.abs(first[1] - last[1]) <= BOUNDARY_TOLERANCE &&
      Math.abs(first[2] - last[2]) <= BOUNDARY_TOLERANCE
    );
  });
}

/**
 * Resolves the edge data required by the current selector.
 */
function edgeTouchesCutRegionBoundary(
  oc: OC,
  edge: unknown,
  frame: FaceFrame,
  bounds: Bounds,
): boolean {
  const endpointsTouch = safeEdgeTest(() => {
    const [first, last] = readEdgeEndpoints(oc, edge).map((point) =>
      toLocalPoint(point, frame),
    ) as [Vec3, Vec3];
    return (
      edgeOnBoundary(first, last, [0, bounds.xMin.current]) ||
      edgeOnBoundary(first, last, [0, bounds.xMax.current]) ||
      edgeOnBoundary(first, last, [1, bounds.yMin.current]) ||
      edgeOnBoundary(first, last, [1, bounds.yMax.current])
    );
  });
  if (endpointsTouch) return true;

  const edgeBounds = getBounds(oc, edge, frame);
  return (
    near(edgeBounds.xMin.current, bounds.xMin.current) ||
    near(edgeBounds.xMax.current, bounds.xMax.current) ||
    near(edgeBounds.yMin.current, bounds.yMin.current) ||
    near(edgeBounds.yMax.current, bounds.yMax.current)
  );
}

/**
 * Returns inner face plane edges from the supplied input.
 */
function getInnerFacePlaneEdges(
  oc: OC,
  entry: ShapeEntry,
  dir: FaceDir,
  edges: unknown[],
): unknown[] {
  if (dir === 'top') {
    const attachmentEdges = getAttachmentPlaneEdges(oc, entry, edges);
    return attachmentEdges.length > 0
      ? attachmentEdges
      : getCutRegionPlaneEdges(oc, entry, dir);
  }
  if (dir === 'bottom' && edges.length === 0) {
    return getCutRegionPlaneEdges(oc, entry, dir);
  }
  return [];
}

/**
 * Handles filter edges to extreme local plane in the topology flow.
 */
function filterEdgesToExtremeLocalPlane(
  oc: OC,
  entry: ShapeEntry,
  dir: FaceDir,
  edges: unknown[],
): unknown[] {
  if (edges.length === 0 || (dir !== 'top' && dir !== 'bottom')) return [];
  const edgePlanes = edges
    .map((edge) => {
      try {
        return { edge, z: edgeMidpointLocalZ(oc, edge, entry.frame) };
      } catch {
        return null;
      }
    })
    .filter((item): item is { edge: unknown; z: number } => item !== null);
  if (edgePlanes.length === 0) return [];
  const target =
    dir === 'top'
      ? Math.max(...edgePlanes.map((item) => item.z))
      : Math.min(...edgePlanes.map((item) => item.z));
  return uniqueEdges(
    edgePlanes.filter((item) => near(item.z, target)).map((item) => item.edge),
  );
}

/**
 * Resolves the edge data required by the current selector.
 */
function edgeMidpointLocalZ(oc: OC, edge: unknown, frame: FaceFrame): number {
  return toLocalPoint(edgeMidpoint(oc, edge), frame)[2];
}

/**
 * Finds cut-alias edges on the requested top or bottom region plane.
 * OCCT can classify a blind-pocket floor by its upward normal rather than by
 * the user-facing `bottom` selector. The cutter region still gives us the
 * correct lower plane and footprint for `pocket.bottom.edges`.
 */
function getCutRegionPlaneEdges(
  oc: OC,
  entry: ShapeEntry,
  dir: FaceDir,
): unknown[] {
  return getCutRegionPlaneCandidateEdges(oc, entry, dir, false);
}

/**
 * Keeps generated cut-feature selectors anchored to the face where the cut began.
 * A later through-cut can add additional interior edges on lower pocket floors.
 * `pocket.top.edges` should describe the entrance rim on the source plane; the
 * lower intersections need their own selector path.
 */
function getAttachmentPlaneEdges(
  oc: OC,
  entry: ShapeEntry,
  edges: unknown[],
): unknown[] {
  const plane = entry.attachmentPlane ?? entry.source?.attachmentPlane;
  if (!plane || edges.length === 0) return [];
  return uniqueEdges(
    edges.filter((edge) =>
      safeEdgeTest(() => edgeLiesOnAttachmentPlane(oc, edge, plane)),
    ),
  );
}

/**
 * Resolves the edge data required by the current selector.
 */
function edgeLiesOnAttachmentPlane(
  oc: OC,
  edge: unknown,
  plane: SourceAttachmentPlane,
): boolean {
  const [first, last] = readEdgeEndpoints(oc, edge);
  return (
    pointDistanceFromPlane(first, plane) <= BOUNDARY_TOLERANCE &&
    pointDistanceFromPlane(last, plane) <= BOUNDARY_TOLERANCE
  );
}

/**
 * Creates point geometry from the supplied coordinates.
 */
function pointDistanceFromPlane(
  point: Vec3,
  plane: SourceAttachmentPlane,
): number {
  return Math.abs(dot(subtractVec(point, plane.origin), plane.normal));
}

/**
 * Handles safe edge test in the topology flow.
 */
function safeEdgeTest(fn: () => boolean): boolean {
  try {
    return fn();
  } catch {
    return false;
  }
}

/**
 * Checks whether the current state allows use shape boundary anchor.
 */
function canUseShapeBoundaryAnchor(
  entry: ShapeEntry,
  ref: ParsedFaceRef,
): boolean {
  return (
    entry.edgeMode === 'outer' &&
    ref.qualifier !== 'inner' &&
    (ref.face === 'top' || ref.face === 'bottom')
  );
}

/**
 * Returns face coord system from the supplied input.
 */
function getFaceCoordSystem(
  oc: OC,
  entry: ShapeEntry,
  face: unknown,
  ref: ParsedFaceRef,
): unknown /* gp_Ax2 */ {
  const dir = ref.face ?? 'top';
  const origin = canUseShapeBoundaryAnchor(entry, ref)
    ? getShapeBoundaryAnchorPoint(oc, entry, dir, ref)
    : getFaceAnchorPoint(oc, face, dir, ref, entry.frame);

  return makeAxisAtPoint(oc, origin, dir, entry.frame, ref.qualifier);
}

/**
 * Returns shape boundary coord system from the supplied input.
 */
function getShapeBoundaryCoordSystem(
  oc: OC,
  entry: ShapeEntry,
  dir: FaceDir,
  ref: ParsedFaceRef,
): unknown /* gp_Ax2 */ {
  return makeAxisAtPoint(
    oc,
    getShapeBoundaryAnchorPoint(oc, entry, dir, ref),
    dir,
    entry.frame,
    ref.qualifier,
  );
}

/**
 * Returns cylindrical surface coord system from the supplied input.
 */
function getCylindricalSurfaceCoordSystem(
  oc: OC,
  entry: ShapeEntry,
  angleDeg: number,
): unknown /* gp_Ax2 */ {
  const bounds = getBounds(oc, entry.shape, entry.frame);
  const center = boundsCenter(bounds);
  const radius =
    Math.max(
      bounds.xMax.current - bounds.xMin.current,
      bounds.yMax.current - bounds.yMin.current,
    ) / 2;
  const angle = (angleDeg * Math.PI) / 180;
  const radial: Vec3 = [Math.cos(angle), Math.sin(angle), 0];
  const localPoint: Vec3 = [
    center[0] + radial[0] * radius,
    center[1] + radial[1] * radius,
    center[2],
  ];
  const [px, py, pz] = toWorldVector(localPoint, entry.frame);
  const [nx, ny, nz] = toWorldVector(radial, entry.frame);
  const [xx, xy, xz] = toWorldVector([0, 0, 1], entry.frame);
  const origin = new oc.gp_Pnt_3(px, py, pz);
  const normal = new oc.gp_Dir_4(nx, ny, nz);
  const tangent = new oc.gp_Dir_4(xx, xy, xz);
  const ax2 = new oc.gp_Ax2_2(origin, normal, tangent);
  origin.delete();
  normal.delete();
  tangent.delete();
  return ax2;
}

/**
 * Constructs axis at point from the supplied values.
 */
function makeAxisAtPoint(
  oc: OC,
  origin: unknown,
  dir: FaceDir,
  frame: FaceFrame,
  qualifier?: 'inner' | 'outer',
): unknown /* gp_Ax2 */ {
  let [nx, ny, nz] = toWorldVector(dirToNormal(dir), frame);
  if (qualifier === 'inner') {
    nx = -nx;
    ny = -ny;
    nz = -nz;
  }
  const [[xx, xy, xz]] = dirToOffsetAxes(dir).map((axis) =>
    toWorldVector(axis, frame),
  ) as [Vec3, Vec3];
  const zDir = new oc.gp_Dir_4(nx, ny, nz);
  const xDir = new oc.gp_Dir_4(xx, xy, xz);

  const ax2 = new oc.gp_Ax2_2(origin, zDir, xDir);
  (origin as { delete(): void }).delete();
  zDir.delete();
  xDir.delete();
  return ax2;
}

/**
 * Returns face anchor point from the supplied input.
 */
function getFaceAnchorPoint(
  oc: OC,
  face: unknown,
  dir: FaceDir,
  ref: ParsedFaceRef,
  frame: FaceFrame,
): unknown {
  if (ref.subRef === 'center') return getFaceCenterPoint(oc, face);
  return getFaceCornerPoint(
    oc,
    face,
    dir,
    ref.subRef === 'corner' ? ref.cornerArg : defaultCornerForFace(dir),
    frame,
  );
}

/**
 * Returns shape boundary anchor point from the supplied input.
 */
function getShapeBoundaryAnchorPoint(
  oc: OC,
  entry: ShapeEntry,
  dir: FaceDir,
  ref: ParsedFaceRef,
): unknown {
  const bounds = entry.regionBounds ?? getBounds(oc, entry.shape, entry.frame);
  if (ref.subRef === 'center')
    return getBoundsFaceCenterPoint(oc, bounds, dir, entry.frame);
  return getBoundsCornerPoint(
    oc,
    bounds,
    dir,
    ref.subRef === 'corner' ? ref.cornerArg : defaultCornerForFace(dir),
    entry.frame,
  );
}

/**
 * Returns face center point from the supplied input.
 */
function getFaceCenterPoint(oc: OC, face: unknown): unknown {
  const gprops = new oc.GProp_GProps_1();
  oc.BRepGProp.SurfaceProperties_1(face, gprops, false, false);
  const centroid = gprops.CentreOfMass();
  gprops.delete();
  return centroid;
}

/**
 * Returns bounds face center point from the supplied input.
 */
function getBoundsFaceCenterPoint(
  oc: OC,
  bounds: ReturnType<typeof getBounds>,
  dir: FaceDir,
  frame: FaceFrame,
): unknown {
  return boundsFacePoint(oc, bounds, dir, boundsCenter(bounds), frame);
}

/**
 * Returns face center coords from the supplied input.
 */
function getFaceCenterCoords(oc: OC, face: unknown): Vec3 | null {
  try {
    const center = getFaceCenterPoint(oc, face) as {
      X(): number;
      Y(): number;
      Z(): number;
      delete(): void;
    };
    const result: Vec3 = [center.X(), center.Y(), center.Z()];
    center.delete();
    return result;
  } catch {
    return null;
  }
}

/**
 * Returns face corner point from the supplied input.
 */
function getFaceCornerPoint(
  oc: OC,
  face: unknown,
  dir: FaceDir,
  cornerArg: string | undefined,
  frame: FaceFrame,
): unknown {
  return getBoundsCornerPoint(
    oc,
    getBounds(oc, face, frame),
    dir,
    cornerArg,
    frame,
  );
}

/**
 * Returns bounds corner point from the supplied input.
 */
function getBoundsCornerPoint(
  oc: OC,
  bounds: ReturnType<typeof getBounds>,
  dir: FaceDir,
  cornerArg = '',
  frame: FaceFrame,
): unknown {
  const x = cornerArg.includes('right')
    ? bounds.xMax.current
    : bounds.xMin.current;
  const y = cornerArg.includes('back')
    ? bounds.yMax.current
    : bounds.yMin.current;
  const z = cornerArg.includes('bottom')
    ? bounds.zMin.current
    : bounds.zMax.current;

  return boundsFacePoint(oc, bounds, dir, [x, y, z], frame);
}

/**
 * Calculates the bounds of the supplied geometry.
 */
function boundsFacePoint(
  oc: OC,
  bounds: ReturnType<typeof getBounds>,
  dir: FaceDir,
  [x, y, z]: Vec3,
  frame: FaceFrame,
): unknown {
  switch (dir) {
    case 'top':
      return makePointFromLocal(oc, [x, y, bounds.zMax.current], frame);
    case 'bottom':
      return makePointFromLocal(oc, [x, y, bounds.zMin.current], frame);
    case 'front':
      return makePointFromLocal(oc, [x, bounds.yMin.current, z], frame);
    case 'back':
      return makePointFromLocal(oc, [x, bounds.yMax.current, z], frame);
    case 'left':
      return makePointFromLocal(oc, [bounds.xMin.current, y, z], frame);
    case 'right':
      return makePointFromLocal(oc, [bounds.xMax.current, y, z], frame);
  }
}

/**
 * Returns the default corner for face used by this module.
 */
function defaultCornerForFace(dir: FaceDir): string {
  return dir === 'top' || dir === 'bottom' ? 'back_left' : 'top_left';
}

/**
 * Resolves the face data required by the current selector.
 */
function faceQualifier(
  normal: Vec3,
  faceCenter: Vec3,
  shapeCenter: Vec3,
): 'inner' | 'outer' {
  const [nx, ny, nz] = normal;
  const [fx, fy, fz] = faceCenter;
  const [sx, sy, sz] = shapeCenter;
  const dot = nx * (fx - sx) + ny * (fy - sy) + nz * (fz - sz);
  return dot >= 0 ? 'outer' : 'inner';
}

/**
 * Returns bounds from the supplied input.
 */
function getBounds(
  oc: OC,
  shape: unknown,
  frame: FaceFrame = WORLD_FRAME,
): Bounds {
  const rawBounds = readBounds(oc, shape);
  const bboxPoints = bboxCornerPoints(rawBounds);
  const edgePoints = sampleEdgePoints(oc, shape);
  return boundsFromPoints(
    [...bboxPoints, ...edgePoints].map((point) => toLocalPoint(point, frame)),
  );
}

/**
 * Returns whether the input meets the `perimeter edge` condition.
 */
function isPerimeterEdge(
  oc: OC,
  edge: unknown,
  bounds: Bounds,
  dir: FaceDir,
  frame: FaceFrame,
): boolean {
  const { u1, v1, u2, v2, uMin, uMax, vMin, vMax } = faceEdgePlaneMetrics(
    oc,
    edge,
    bounds,
    dir,
    frame,
  );

  return (
    (near(u1, uMin) && near(u2, uMin)) ||
    (near(u1, uMax) && near(u2, uMax)) ||
    (near(v1, vMin) && near(v2, vMin)) ||
    (near(v1, vMax) && near(v2, vMax))
  );
}

/**
 * Returns whether the input meets the `named face edge` condition.
 */
function isNamedFaceEdge(
  oc: OC,
  edge: unknown,
  bounds: Bounds,
  dir: FaceDir,
  edgeArg: string,
  frame: FaceFrame,
): boolean {
  const { u1, v1, u2, v2, uMin, uMax, vMin, vMax } = faceEdgePlaneMetrics(
    oc,
    edge,
    bounds,
    dir,
    frame,
  );
  return namedFaceEdgeMatch(edgeArg, dir, {
    u1,
    v1,
    u2,
    v2,
    uMin,
    uMax,
    vMin,
    vMax,
  });
}

/**
 * Type used for measurements for face edge plane.
 */
type FaceEdgePlaneMetrics = ReturnType<typeof faceEdgePlaneMetrics>;

/**
 * Defines the `NamedFaceEdgeMatcher` callback contract used by the topology layer.
 */
type NamedFaceEdgeMatcher = (
  dir: FaceDir,
  metrics: FaceEdgePlaneMetrics,
) => boolean;

const NAMED_FACE_EDGE_MATCHERS: Record<string, NamedFaceEdgeMatcher> = {
  left: (_dir, metrics) => edgeOnU(metrics, metrics.uMin),
  right: (_dir, metrics) => edgeOnU(metrics, metrics.uMax),
  front: (dir, metrics) =>
    isSideFace(dir)
      ? edgeOnU(metrics, metrics.uMin)
      : edgeOnV(metrics, metrics.vMin),
  back: (dir, metrics) =>
    isSideFace(dir)
      ? edgeOnU(metrics, metrics.uMax)
      : edgeOnV(metrics, metrics.vMax),
  bottom: (_dir, metrics) => edgeOnV(metrics, metrics.vMin),
  top: (_dir, metrics) => edgeOnV(metrics, metrics.vMax),
};

/**
 * Handles named face edge match in the topology flow.
 */
function namedFaceEdgeMatch(
  edgeArg: string,
  dir: FaceDir,
  metrics: FaceEdgePlaneMetrics,
): boolean {
  return NAMED_FACE_EDGE_MATCHERS[edgeArg]?.(dir, metrics) ?? false;
}

/**
 * Resolves the edge data required by the current selector.
 */
function edgeOnU(metrics: FaceEdgePlaneMetrics, value: number): boolean {
  return near(metrics.u1, value) && near(metrics.u2, value);
}

/**
 * Resolves the edge data required by the current selector.
 */
function edgeOnV(metrics: FaceEdgePlaneMetrics, value: number): boolean {
  return near(metrics.v1, value) && near(metrics.v2, value);
}

/**
 * Returns whether the input meets the `side face` condition.
 */
function isSideFace(dir: FaceDir): boolean {
  return dir === 'left' || dir === 'right';
}

/**
 * Resolves the face data required by the current selector.
 */
function faceEdgePlaneMetrics(
  oc: OC,
  edge: unknown,
  bounds: Bounds,
  dir: FaceDir,
  frame: FaceFrame,
): {
  u1: number;
  v1: number;
  u2: number;
  v2: number;
  uMin: number;
  uMax: number;
  vMin: number;
  vMax: number;
} {
  const [first, last] = readEdgeEndpoints(oc, edge);
  const [u1, v1] = facePlaneCoords(first, dir, frame);
  const [u2, v2] = facePlaneCoords(last, dir, frame);
  return { u1, v1, u2, v2, ...facePlaneBounds(bounds, dir) };
}

/**
 * Returns whether the input meets the `shape perimeter edge` condition.
 */
function isShapePerimeterEdge(
  oc: OC,
  edge: unknown,
  bounds: Bounds,
  dir: FaceDir,
  frame: FaceFrame,
): boolean {
  const [first, last] = readEdgeEndpoints(oc, edge);
  const firstLocal = toLocalPoint(first, frame);
  const lastLocal = toLocalPoint(last, frame);
  switch (dir) {
    case 'top':
      return edgeOnFacePerimeter(
        firstLocal,
        lastLocal,
        [2, bounds.zMax.current],
        facePerimeterBoundaries(bounds, 0, 1),
      );
    case 'bottom':
      return edgeOnFacePerimeter(
        firstLocal,
        lastLocal,
        [2, bounds.zMin.current],
        facePerimeterBoundaries(bounds, 0, 1),
      );
    case 'front':
      return edgeOnFacePerimeter(
        firstLocal,
        lastLocal,
        [1, bounds.yMin.current],
        facePerimeterBoundaries(bounds, 0, 2),
      );
    case 'back':
      return edgeOnFacePerimeter(
        firstLocal,
        lastLocal,
        [1, bounds.yMax.current],
        facePerimeterBoundaries(bounds, 0, 2),
      );
    case 'left':
      return edgeOnFacePerimeter(
        firstLocal,
        lastLocal,
        [0, bounds.xMin.current],
        facePerimeterBoundaries(bounds, 1, 2),
      );
    case 'right':
      return edgeOnFacePerimeter(
        firstLocal,
        lastLocal,
        [0, bounds.xMax.current],
        facePerimeterBoundaries(bounds, 1, 2),
      );
  }
}

/**
 * Resolves the edge data required by the current selector.
 */
function edgeOnFacePerimeter(
  first: Vec3,
  last: Vec3,
  faceBoundary: Boundary,
  perimeterBoundaries: Boundary[],
): boolean {
  return (
    edgeOnBoundary(first, last, faceBoundary) &&
    perimeterBoundaries.some((boundary) =>
      edgeOnBoundary(first, last, boundary),
    )
  );
}

/**
 * Resolves the edge data required by the current selector.
 */
function edgeOnBoundary(
  first: Vec3,
  last: Vec3,
  [axis, value]: Boundary,
): boolean {
  return near(first[axis], value) && near(last[axis], value);
}

/**
 * Resolves the face data required by the current selector.
 */
function facePerimeterBoundaries(
  bounds: Bounds,
  uAxis: Axis,
  vAxis: Axis,
): Boundary[] {
  const minByAxis = [
    bounds.xMin.current,
    bounds.yMin.current,
    bounds.zMin.current,
  ] as const;
  const maxByAxis = [
    bounds.xMax.current,
    bounds.yMax.current,
    bounds.zMax.current,
  ] as const;
  return [
    [uAxis, minByAxis[uAxis]],
    [uAxis, maxByAxis[uAxis]],
    [vAxis, minByAxis[vAxis]],
    [vAxis, maxByAxis[vAxis]],
  ];
}

/**
 * Resolves the face data required by the current selector.
 */
function facePlaneCoords(
  point: Vec3,
  dir: FaceDir,
  frame: FaceFrame,
): [number, number] {
  const [x, y, z] = toLocalPoint(point, frame);
  switch (dir) {
    case 'top':
    case 'bottom':
      return [x, y];
    case 'front':
    case 'back':
      return [x, z];
    case 'left':
    case 'right':
      return [y, z];
  }
}

/**
 * Resolves the face data required by the current selector.
 */
function facePlaneBounds(
  bounds: Bounds,
  dir: FaceDir,
): { uMin: number; uMax: number; vMin: number; vMax: number } {
  switch (dir) {
    case 'top':
    case 'bottom':
      return {
        uMin: bounds.xMin.current,
        uMax: bounds.xMax.current,
        vMin: bounds.yMin.current,
        vMax: bounds.yMax.current,
      };
    case 'front':
    case 'back':
      return {
        uMin: bounds.xMin.current,
        uMax: bounds.xMax.current,
        vMin: bounds.zMin.current,
        vMax: bounds.zMax.current,
      };
    case 'left':
    case 'right':
      return {
        uMin: bounds.yMin.current,
        uMax: bounds.yMax.current,
        vMin: bounds.zMin.current,
        vMax: bounds.zMax.current,
      };
  }
}

/**
 * Calculates the distance between the supplied points.
 */
function distanceVec(a: Vec3, b: Vec3): number {
  const delta = subtractVec(a, b);
  return Math.sqrt(dot(delta, delta));
}

/**
 * Calculates the bounds of the supplied geometry.
 */
function boundsSizeDifference(a: Bounds, b: Bounds): number {
  const aSize = boundsSize(a);
  const bSize = boundsSize(b);
  return Math.max(
    Math.abs(aSize[0] - bSize[0]),
    Math.abs(aSize[1] - bSize[1]),
    Math.abs(aSize[2] - bSize[2]),
  );
}

/**
 * Calculates the bounds of the supplied geometry.
 */
function boundsSize(bounds: Bounds): Vec3 {
  return [
    bounds.xMax.current - bounds.xMin.current,
    bounds.yMax.current - bounds.yMin.current,
    bounds.zMax.current - bounds.zMin.current,
  ];
}

/**
 * Calculates the bounds of the supplied geometry.
 */
function boundsCenter(bounds: ReturnType<typeof getBounds>): Vec3 {
  return [
    (bounds.xMin.current + bounds.xMax.current) / 2,
    (bounds.yMin.current + bounds.yMax.current) / 2,
    (bounds.zMin.current + bounds.zMax.current) / 2,
  ];
}

/**
 * Calculates the bounds of the supplied geometry.
 */
function boundsFromPoints(points: Vec3[]): ReturnType<typeof getBounds> {
  const bounds = bounds3FromPoints(points);
  if (!bounds) {
    return {
      xMin: { current: 0 },
      xMax: { current: 0 },
      yMin: { current: 0 },
      yMax: { current: 0 },
      zMin: { current: 0 },
      zMax: { current: 0 },
    };
  }

  return {
    xMin: { current: bounds.xMin },
    xMax: { current: bounds.xMax },
    yMin: { current: bounds.yMin },
    yMax: { current: bounds.yMax },
    zMin: { current: bounds.zMin },
    zMax: { current: bounds.zMax },
  };
}

/**
 * Handles bbox corner points in the topology flow.
 */
function bboxCornerPoints(bounds: Bounds): Vec3[] {
  const xs = [bounds.xMin.current, bounds.xMax.current];
  const ys = [bounds.yMin.current, bounds.yMax.current];
  const zs = [bounds.zMin.current, bounds.zMax.current];
  const points: Vec3[] = [];
  for (const x of xs) {
    for (const y of ys) {
      for (const z of zs) {
        points.push([x, y, z]);
      }
    }
  }
  return points;
}

/**
 * Handles sample edge points in the topology flow.
 */
function sampleEdgePoints(oc: OC, shape: unknown): Vec3[] {
  const points: Vec3[] = [];
  for (const edge of getEdges(oc, shape)) {
    try {
      const [first, last] = readEdgeEndpoints(oc, edge);
      points.push(first, last);
    } catch {
      // Some OCCT edge wrappers cannot expose vertices during intermediate topology updates.
    }
  }
  return points;
}

/**
 * Handles near in the topology flow.
 */
function near(a: number, b: number, tol = BOUNDARY_TOLERANCE): boolean {
  return Math.abs(a - b) <= tol;
}

/**
 * Removes duplicate edges values while preserving their first occurrence.
 */
function uniqueEdges(edges: unknown[]): unknown[] {
  return uniqueShapes(edges);
}

/**
 * Translates axis by the supplied offset.
 */
function translateAxis(
  oc: OC,
  ax2: unknown,
  dir: FaceDir,
  ref: ParsedFaceRef,
  dx: number,
  dy: number,
  frame: FaceFrame,
): unknown /* gp_Ax2 */ {
  const a = ax2 as Record<string, () => unknown>;
  const loc = a.Location() as Record<string, () => number>;
  const [[ux, uy, uz], [vx, vy, vz]] = placementOffsetAxes(dir, ref).map(
    (axis) => toWorldVector(axis, frame),
  ) as [Vec3, Vec3];
  const zd = a.Direction() as unknown;

  const x = loc.X() + ux * dx + vx * dy;
  const y = loc.Y() + uy * dx + vy * dy;
  const z = loc.Z() + uz * dx + vz * dy;

  const newLoc = new oc.gp_Pnt_3(x, y, z);
  const newAx2 = new oc.gp_Ax2_2(newLoc, zd, a.XDirection());
  (loc as unknown as { delete(): void }).delete();
  (newLoc as { delete(): void }).delete();
  (ax2 as { delete(): void }).delete();
  return newAx2;
}
