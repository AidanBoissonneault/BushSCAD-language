/** Implements the extrude behavior owned by the OCCT bridge. */

import { OperationsBridge } from '../../sketch/operations/operations.js';

import { shapeDisablesFuseGlue } from '../../bridge/occt-bridge-base.js';

import type { IRExtrude, IRPlacement, SourceSpan } from '@bushscad/ir';

import { faceFrameFromAx2 } from '../../topology/face-labels.js';

import { registerPrimitiveNamedEdgesForBody } from '../../topology/primitive-named-edge-labels.js';

import {
  buildProfileRegionExtrudeSolid,
  type ProfileRegionExtrudeResult,
} from '../../profiles/profile-region-solids.js';

import {
  exactRegionProfileSelectionSource,
  profileSelectionLocalFaceTransform,
} from '../../profiles/profile-selection-placement.js';

import { isOcctError, occtError } from '../../core/occt-errors.js';

import { attachmentPlane } from '../../primitives/solid-primitive-geometry.js';

import { clipSurfaceBoundSketchFace } from '../../surfaces/surface-bound-sketches.js';

import { applyStableBoolFuse } from '../boolean-operations.js';

import { makePartFuseOverlapExtrudeInput } from '../additive-overlap.js';

import type { SourceAttachmentPlane } from '../../topology/source-edge-recovery.js';

import type { GroupBuildState, OC } from '../../bridge/bridge-types.js';

export abstract class ExtrudeBridge extends OperationsBridge {
  protected override buildExtrudeOperation(
    state: GroupBuildState,
    op: IRExtrude,
  ): void {
    if (this.tryBuildWrappedExtrudeOperation(state, op)) return;
    if (this.tryBuildExactProfileRegionExtrudeOperation(state, op)) return;
    this.buildStandardExtrudeOperation(state, op);
  }

  protected override tryBuildWrappedExtrudeOperation(
    state: GroupBuildState,
    op: IRExtrude,
  ): boolean {
    if (!op.wrap) return false;
    this.ensureCylindricalWrapTarget(state, op.from, op.span);
    const wrapShape = this.buildCylindricalWrapShape(
      state,
      op.sketchName,
      op.from!,
      op.depth,
      op.span,
    );
    if (!wrapShape) return false;
    const ax2 = state.labelMap.resolveAxis(this.oc, op.from!);
    this.addBody(
      state,
      op.objName,
      wrapShape,
      faceFrameFromAx2(ax2),
      op.material ?? null,
      op.span,
    );
    return true;
  }

  protected override buildStandardExtrudeOperation(
    state: GroupBuildState,
    op: IRExtrude,
  ): void {
    const { sketchFace, ax2 } = this.resolveSketchFaceAndAxis(
      state,
      op.sketchName,
      op.from,
      op.span,
      op.closedBodyNames,
    );
    const positionedFace = this.positionSketchFaceForExtrude(
      sketchFace,
      ax2,
      op,
    );
    const placedFace = clipSurfaceBoundSketchFace(
      this.oc,
      state,
      op.sketchName,
      positionedFace,
      op.span,
    );
    const extrudeInput = this.partFuseExtrudeInput(state, op, placedFace, ax2);
    const shape = this.applyExtrude(
      extrudeInput.face,
      ax2,
      extrudeInput.depth,
      op.symmetric,
      op.span,
    );
    if (extrudeInput.overlapped) {
      this.disableFuseGlue(shape);
    }
    extrudeInput.face.delete();
    this.addExtrudedBody(state, op, shape, ax2);
    registerPrimitiveNamedEdgesForBody(
      this.oc,
      state,
      op.objName,
      op.sketchName,
    );
  }

  protected override positionSketchFaceForExtrude(
    sketchFace: OC,
    ax2: OC,
    op: IRExtrude,
  ): OC {
    const positionedFace = this.positionFace(sketchFace, ax2);
    if (op.closedBodyNames?.length) sketchFace.delete();
    return positionedFace;
  }

  protected override partFuseExtrudeInput(
    state: GroupBuildState,
    op: IRExtrude,
    placedFace: OC,
    ax2: OC,
    depth = op.depth,
  ): { face: OC; depth: number; overlapped?: true } {
    if (!this.shouldOverlapPartExtrude(state, op)) {
      return { face: placedFace, depth };
    }
    return makePartFuseOverlapExtrudeInput(
      this.oc,
      placedFace,
      ax2,
      depth,
      op.span,
    );
  }

  protected override shouldOverlapPartExtrude(
    state: GroupBuildState,
    op: IRExtrude,
  ): boolean {
    return Boolean(
      state.partSolidOwner &&
      state.partSolidComponents.size > 0 &&
      op.from &&
      !op.symmetric,
    );
  }

  protected override tryBuildExactProfileRegionExtrudeOperation(
    state: GroupBuildState,
    op: IRExtrude,
  ): boolean {
    const exactRegion = this.buildExactProfileRegionExtrude(
      state,
      op.sketchName,
      op.from,
      op.depth,
      op.symmetric,
      op.span,
      op.closedBodyNames,
      this.shouldOverlapPartExtrude(state, op),
    );
    if (!exactRegion) return false;
    if (exactRegion.overlapped) {
      this.disableFuseGlue(exactRegion.shape);
    }
    this.addExtrudedBody(state, op, exactRegion.shape, exactRegion.ax2);
    registerPrimitiveNamedEdgesForBody(
      this.oc,
      state,
      op.objName,
      op.sketchName,
    );
    return true;
  }

  protected override disableFuseGlue(shape: OC): void {
    (shape as { _disableFuseGlue?: boolean })._disableFuseGlue = true;
  }

  protected override addExtrudedBody(
    state: GroupBuildState,
    op: IRExtrude,
    shape: OC,
    ax2: OC,
  ): void {
    this.addBody(
      state,
      op.objName,
      shape,
      faceFrameFromAx2(ax2),
      op.material ?? null,
      op.span,
      op.from ? this.sourceAttachmentPlane(ax2) : undefined,
    );
  }

  protected override sourceAttachmentPlane(ax2: OC): SourceAttachmentPlane {
    return attachmentPlane(ax2);
  }

  protected override applyBoolFuse(
    a: OC,
    b: OC,
    span: SourceSpan,
    failureMessage = 'Boolean fuse failed',
  ): OC {
    return applyStableBoolFuse(this.oc, a, b, span, failureMessage, {
      configure: false,
      simplify: false,
      useGlue: !shapeDisablesFuseGlue(b),
    });
  }

  protected override buildExactProfileRegionExtrude(
    state: GroupBuildState,
    sketchName: string,
    from: IRPlacement | null,
    depth: number,
    symmetric: boolean,
    span: SourceSpan,
    closedBodyNames?: string[],
    overlapAdditive = false,
  ): (ProfileRegionExtrudeResult & { ax2: OC }) | null {
    const source = exactRegionProfileSelectionSource(
      state.sketchPrimitives.get(sketchName),
      closedBodyNames,
    );
    if (!source) return null;
    const ax2 = this.resolveSketchAxis(state, sketchName, from);
    const result = buildProfileRegionExtrudeSolid({
      oc: this.oc,
      primitive: source.profile,
      ax2,
      depth,
      symmetric,
      span,
      selectedNames: closedBodyNames,
      overlapAdditive,
      transformLocalFace: profileSelectionLocalFaceTransform(
        source,
        this.translateSketchShape.bind(this),
      ),
      clipPlacedFace: (face) =>
        clipSurfaceBoundSketchFace(this.oc, state, sketchName, face, span),
    });
    return { ...result, ax2 };
  }

  protected override applyExtrude(
    face: OC,
    ax2: OC,
    depth: number,
    symmetric: boolean,
    span: SourceSpan,
  ): OC {
    const oc = this.oc;
    const dir = (ax2 as Record<string, () => OC>).Direction();
    const dx = (dir as Record<string, () => number>).X();
    const dy = (dir as Record<string, () => number>).Y();
    const dz = (dir as Record<string, () => number>).Z();

    const vec = new oc.gp_Vec_4(dx * depth, dy * depth, dz * depth);
    let prism: OC | null = null;
    let shape: OC;
    try {
      prism = new oc.BRepPrimAPI_MakePrism_1(face, vec, false, true);
      if (!prism.IsDone()) throw occtError('Extrude failed', span);
      shape = prism.Shape();
    } catch (err) {
      if (isOcctError(err)) throw err;
      throw occtError(
        `OCCT extrude operation failed unexpectedly: ${
          err instanceof Error ? err.message : String(err)
        }`,
        span,
      );
    } finally {
      vec.delete();
      prism?.delete?.();
      (dir as { delete(): void }).delete();
    }

    if (symmetric) {
      const trsf = new oc.gp_Trsf_1();
      const halfVec = new oc.gp_Vec_4(
        (-dx * depth) / 2,
        (-dy * depth) / 2,
        (-dz * depth) / 2,
      );
      trsf.SetTranslation_1(halfVec);
      const loc = new oc.TopLoc_Location_2(trsf);
      shape = (shape as OC).Located(loc);
      [trsf, halfVec, loc].forEach((o: OC) => o.delete());
    }

    return shape;
  }
}
