/** Implements the cut behavior owned by the OCCT bridge. */

import { ExtrudeBridge } from '../extrude/extrude.js';

import type { IRCut, IRPlacement, SourceSpan } from '@bushscad/ir';

import { faceFrameFromAx2 } from '../../topology/face-labels.js';

import { parseFaceRef } from '../../core/program-utils.js';

import {
  makeDefaultAxis,
  boundsOverlap,
  readBounds,
  type Vec3,
} from '../../core/geometry-utils.js';

import { registerPrimitiveNamedEdgesForBody } from '../../topology/primitive-named-edge-labels.js';

import { buildProfileRegionExtrudeSolid } from '../../profiles/profile-region-solids.js';

import {
  buildPlacedSelectedProfileFace,
  exactRegionProfileSelectionSource,
  profileSelectionLocalFaceTransform,
} from '../../profiles/profile-selection-placement.js';

import { occtError } from '../../core/occt-errors.js';

import { clipSurfaceBoundSketchFace } from '../../surfaces/surface-bound-sketches.js';

import { applyStableBoolCut } from '../boolean-operations.js';

import {
  aliasDeferredPartCut,
  cutDeferredPartComponents,
  flushDeferredPartSolid,
} from '../part-solid.js';

import { type PreparedNativeCut } from '../native-boolean-batch-runtime.js';

import { nativeParallelBooleanCapability } from '../native-parallel-booleans.js';

import type { GroupBuildState, OC } from '../../bridge/bridge-types.js';

export abstract class CutBridge extends ExtrudeBridge {
  protected override buildCutOperation(
    state: GroupBuildState,
    op: IRCut,
  ): void {
    if (this.tryBuildWrapCutOperation(state, op)) return;
    const prepared = this.prepareNativeCutOperation(state, op);
    const result = this.applyBoolCut(
      prepared.targetShape,
      prepared.tool,
      op.span,
    );
    this.commitNativeCutOperation(state, prepared, result);
  }

  protected override prepareNativeCutOperation(
    state: GroupBuildState,
    op: IRCut,
  ): PreparedNativeCut {
    const sketchFace = state.sketchFaces.get(op.sketchName);
    if (!sketchFace)
      throw occtError(`Unknown sketch '${op.sketchName}'`, op.span);
    const parsed = parseFaceRef(op.from.faceRef);
    const targetShape = state.labelMap.getShape(parsed.objName);
    if (!targetShape)
      throw occtError(`Unknown object '${parsed.objName}' for cut`, op.span);
    const ax2 = state.labelMap.resolveAxis(this.oc, op.from);
    const exactTool = this.buildExactProfileRegionCutTool(
      state,
      op,
      ax2,
      targetShape,
    );
    const tool =
      exactTool ??
      this.buildSketchCutTool(state, op, sketchFace, ax2, targetShape);
    return {
      op,
      targetName: parsed.objName,
      targetShape,
      tool,
      axis: ax2,
    };
  }

  protected override commitNativeCutOperation(
    state: GroupBuildState,
    prepared: PreparedNativeCut,
    result: OC,
  ): void {
    const { op, targetName, tool, axis } = prepared;
    const primaryOwner = this.ownerFor(state, targetName);
    if (state.partSolidOwner && primaryOwner === state.partSolidOwner) {
      this.applyDeferredPartCut(state, op, targetName, tool, result, axis);
    } else {
      this.applyDirectCut(state, op, targetName, primaryOwner, tool, result);
      (tool as { delete(): void }).delete();
    }
    registerPrimitiveNamedEdgesForBody(
      this.oc,
      state,
      op.objName,
      op.sketchName,
      { frame: faceFrameFromAx2(axis) },
    );
  }

  protected override commitNativeCutBatch(
    state: GroupBuildState,
    cuts: readonly PreparedNativeCut[],
    result: OC,
  ): void {
    const owner = state.partSolidOwner;
    const first = cuts[0];
    if (!owner || !first) return;
    const component = state.partSolidAliasComponents.get(first.targetName);
    if (!component) return;
    state.partSolidComponents.set(component, result);
    state.bodyShapes.set(owner, result);
    for (const { op, targetName, tool, axis } of cuts) {
      aliasDeferredPartCut(
        state,
        op.objName,
        targetName,
        tool,
        this.sourceAttachmentPlane(axis),
      );
      registerPrimitiveNamedEdgesForBody(
        this.oc,
        state,
        op.objName,
        op.sketchName,
        { frame: faceFrameFromAx2(axis) },
      );
    }
    this.registerPartSolidAliases(state, result);
  }

  protected override tryBuildWrapCutOperation(
    state: GroupBuildState,
    op: IRCut,
  ): boolean {
    if (!op.wrap) return false;
    this.ensureCylindricalWrapTarget(state, op.from, op.span);
    const wrapTool = this.buildCylindricalWrapCutTool(
      state,
      op.sketchName,
      op.from,
      op.through,
      op.depth,
      op.span,
    );
    if (!wrapTool) return false;
    const wrapParsed = parseFaceRef(op.from.faceRef);
    const wrapTarget = state.labelMap.getShape(wrapParsed.objName);
    if (!wrapTarget) {
      throw occtError(
        `Unknown object '${wrapParsed.objName}' for wrap cut`,
        op.span,
      );
    }
    const result = this.applyBoolCut(wrapTarget, wrapTool, op.span);
    (wrapTool as { delete(): void }).delete();
    this.aliasBody(state, op.objName, wrapParsed.objName, 'inner');
    this.replaceBody(state, wrapParsed.objName, result);
    return true;
  }

  protected override applyDeferredPartCut(
    state: GroupBuildState,
    op: IRCut,
    targetAlias: string,
    tool: OC,
    result: OC,
    ax2: OC,
  ): void {
    cutDeferredPartComponents({
      oc: this.oc,
      state,
      targetAlias,
      tool,
      targetResult: result,
      span: op.span,
      applyCut: (shape, cutTool, span) =>
        this.applyBoolCut(shape, cutTool, span),
      registerAlias: (buildState, alias, shape) =>
        this.registerPartSolidAliasComponent(buildState, alias, shape),
    });
    aliasDeferredPartCut(
      state,
      op.objName,
      targetAlias,
      tool,
      this.sourceAttachmentPlane(ax2),
    );
    this.registerPartSolidAliasComponent(state, op.objName, result);
  }

  protected override applyDirectCut(
    state: GroupBuildState,
    op: IRCut,
    targetName: string,
    primaryOwner: string,
    tool: OC,
    result: OC,
  ): void {
    this.aliasBody(state, op.objName, targetName, 'inner');
    this.replaceBody(state, targetName, result);
    this.cutOverlappingBodies(state, primaryOwner, tool, op.span);
  }

  protected override cutOverlappingBodies(
    state: GroupBuildState,
    primaryOwner: string,
    tool: OC,
    span: SourceSpan,
  ): void {
    const toolBounds = readBounds(this.oc, tool);
    const seen = new Set<string>([primaryOwner]);
    for (const [name, shape] of state.bodyShapes) {
      const owner = this.ownerFor(state, name);
      if (seen.has(owner)) continue;
      seen.add(owner);
      const bounds = readBounds(this.oc, shape);
      if (!boundsOverlap(bounds, toolBounds)) continue;
      const cutResult = this.applyBoolCut(shape, tool, span);
      this.replaceBody(state, owner, cutResult);
    }
  }

  protected override resolveSketchFaceAndAxis(
    state: GroupBuildState,
    sketchName: string,
    from: IRPlacement | null,
    span: SourceSpan,
    closedBodyNames?: string[],
  ): { sketchFace: OC; ax2: OC } {
    const sketchFace = closedBodyNames?.length
      ? this.buildSelectedSketchFace(state, sketchName, closedBodyNames, span)
      : state.sketchFaces.get(sketchName);
    if (!sketchFace) throw occtError(`Unknown sketch '${sketchName}'`, span);
    const ax2 = this.resolveSketchAxis(state, sketchName, from);
    return { sketchFace, ax2 };
  }

  protected override resolveSketchAxis(
    state: GroupBuildState,
    sketchName: string,
    from: IRPlacement | null,
  ): OC {
    return from
      ? state.labelMap.resolveAxis(this.oc, from)
      : (state.sketchAxes.get(sketchName) ?? makeDefaultAxis(this.oc));
  }

  protected override buildExactProfileRegionCutTool(
    state: GroupBuildState,
    op: IRCut,
    ax2: OC,
    targetShape: OC,
  ): OC | null {
    const source = exactRegionProfileSelectionSource(
      state.sketchPrimitives.get(op.sketchName),
      op.closedBodyNames,
    );
    if (!source) return null;
    const cutDepth =
      op.depth !== null ? op.depth : this.shapeDiagonal(targetShape) * 2 + 10;
    const signedDepth = this.cutDepthTowardShape(ax2, targetShape, cutDepth);
    return buildProfileRegionExtrudeSolid({
      oc: this.oc,
      primitive: source.profile,
      ax2,
      depth: signedDepth,
      symmetric: false,
      span: op.span,
      selectedNames: op.closedBodyNames,
      transformLocalFace: profileSelectionLocalFaceTransform(
        source,
        this.translateSketchShape.bind(this),
      ),
      clipPlacedFace: (face) =>
        clipSurfaceBoundSketchFace(
          this.oc,
          state,
          op.sketchName,
          face,
          op.span,
        ),
    }).shape;
  }

  protected override buildSketchCutTool(
    state: GroupBuildState,
    op: IRCut,
    sketchFace: OC,
    ax2: OC,
    targetShape: OC,
  ): OC {
    const selectedFace = op.closedBodyNames?.length
      ? this.buildSelectedSketchFace(
          state,
          op.sketchName,
          op.closedBodyNames,
          op.span,
        )
      : sketchFace;
    const positionedFace = this.positionFace(selectedFace, ax2);
    if (op.closedBodyNames?.length) selectedFace.delete();
    const placedFace = clipSurfaceBoundSketchFace(
      this.oc,
      state,
      op.sketchName,
      positionedFace,
      op.span,
    );
    const tool = this.buildCutTool(
      placedFace,
      ax2,
      targetShape,
      op.depth,
      op.span,
    );
    placedFace.delete();
    return tool;
  }

  protected override buildSelectedSketchFace(
    state: GroupBuildState,
    sketchName: string,
    closedBodyNames: string[],
    span: SourceSpan,
  ): OC {
    return buildPlacedSelectedProfileFace({
      oc: this.oc,
      primitive: state.sketchPrimitives.get(sketchName),
      sketchName,
      selectedNames: closedBodyNames,
      span,
      translate: this.translateSketchShape.bind(this),
    });
  }

  protected override buildCutTool(
    sketchFace: OC,
    ax2: OC,
    targetShape: OC,
    depth: number | null,
    span: SourceSpan,
  ): OC {
    const cutDepth =
      depth !== null ? depth : this.shapeDiagonal(targetShape) * 2 + 10;
    const signedDepth = this.cutDepthTowardShape(ax2, targetShape, cutDepth);
    return this.applyExtrude(sketchFace, ax2, signedDepth, false, span);
  }

  protected override cutDepthTowardShape(
    ax2: OC,
    targetShape: OC,
    depth: number,
  ): number {
    const axis = ax2 as Record<string, () => OC>;
    const loc = axis.Location() as Record<string, () => number> & {
      delete(): void;
    };
    const dir = axis.Direction() as Record<string, () => number> & {
      delete(): void;
    };

    const [cx, cy, cz] = this.shapeCenter(targetShape);
    const toCenterX = cx - loc.X();
    const toCenterY = cy - loc.Y();
    const toCenterZ = cz - loc.Z();
    const dot = dir.X() * toCenterX + dir.Y() * toCenterY + dir.Z() * toCenterZ;

    loc.delete();
    dir.delete();

    return dot < 0 ? -depth : depth;
  }

  protected override shapeCenter(shape: OC): Vec3 {
    const { xMin, xMax, yMin, yMax, zMin, zMax } = readBounds(this.oc, shape);
    return [
      (xMin.current + xMax.current) / 2,
      (yMin.current + yMax.current) / 2,
      (zMin.current + zMax.current) / 2,
    ];
  }

  protected override shapeDiagonal(shape: OC): number {
    const { xMin, xMax, yMin, yMax, zMin, zMax } = readBounds(this.oc, shape);
    const dx = xMax.current - xMin.current;
    const dy = yMax.current - yMin.current;
    const dz = zMax.current - zMin.current;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  protected override applyBoolCut(target: OC, tool: OC, span: SourceSpan): OC {
    return applyStableBoolCut(this.oc, target, tool, span);
  }

  protected override canStartNativeBatch(
    state: GroupBuildState,
    targetName: string,
  ): boolean {
    if (
      !nativeParallelBooleanCapability(this.oc) ||
      !state.partSolidOwner ||
      state.partSolidComponents.size !== 1
    )
      return false;
    return this.nativeBatchTargetShape(state, targetName) !== undefined;
  }

  protected override nativeBatchTargetShape(
    state: GroupBuildState,
    targetName: string,
  ): OC | undefined {
    const component = state.partSolidAliasComponents.get(targetName);
    return component ? state.partSolidComponents.get(component) : undefined;
  }

  protected override canFinalizeDeferredPartAsCompound(
    state: GroupBuildState,
  ): boolean {
    return Boolean(
      state.partSolidOwner &&
      (state.partSolidComponents.size > 2 ||
        state.preservedPartComponents.size > 0),
    );
  }

  protected override flushPartSolid(
    state: GroupBuildState,
    span: SourceSpan = { file: '(occt)', line: 1, col: 1 },
  ): OC | null {
    return flushDeferredPartSolid(
      state,
      span,
      (a, b, fuseSpan, failureMessage) =>
        this.applyBoolFuse(a, b, fuseSpan, failureMessage),
      (buildState, shape) => this.registerPartSolidAliases(buildState, shape),
    );
  }

  protected override buildCompound(shapes: OC[]): OC {
    const oc = this.oc;
    const compound = new oc.TopoDS_Compound();
    const builder = new oc.BRep_Builder();
    builder.MakeCompound(compound);
    for (const shape of shapes) builder.Add(compound, shape);
    builder.delete();
    return compound;
  }
}
