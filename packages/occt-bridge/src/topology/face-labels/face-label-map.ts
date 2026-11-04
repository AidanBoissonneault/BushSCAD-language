/** Owns FaceLabelMap and its registration state for the OCCT topology layer. */
import {
  type ShapeEntry,
  type FaceFrame,
  type AxisBaseResolution,
} from './types.js';
import { registeredShapeEntry } from './shape-entry/shape-entry-registration.js';
import {
  filterFacesToRegion,
  uniqueEdges,
  isFaceCylindrical,
  selectFaceByPredicate,
  matchFaces,
  effectiveFaceQualifier,
  resolveWholeShapeEdges,
  resolveCurrentEdges,
  resolveSourceEdges,
  matchSourceEdgesInCurrentShape,
  getCylindricalSurfaceCoordSystem,
  getPredicateFaceCoordSystem,
  canUseShapeBoundaryAnchor,
  getFaceCoordSystem,
  getShapeBoundaryCoordSystem,
  findPerpendicularFeatureBlockers,
  findAttachmentPlaneFeatureBlockers,
  safeEdgeTest,
  edgeMidpointIsInsideAnyRegion,
  resolveCurrentFaceEdges,
} from './selection/selection-resolution.js';
import {
  applyPlanarPlacementOffset,
  applyNormalPlacementOffset,
  applyNormalPlacementRotation,
  applyLocalAxisPlacementRotation,
  applyPlacementAnchorTransform,
} from './placement/placement-transforms.js';
import type { IRPlacement } from '@bushscad/ir';
import { parseFaceRef } from '../../core/program-utils.js';
import type { FaceDir, ParsedFaceRef } from '../../core/program-utils.js';
import {
  getEdges,
  makeDefaultAxis,
  type Vec3,
} from '../../core/geometry-utils.js';
import {
  recoverConsumedSourceEdges,
  type SourceAttachmentPlane,
} from '../source-edge-recovery.js';
import { WORLD_FRAME } from '../face-placement-transform.js';
import type { OC } from '../face-placement-transform.js';

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
