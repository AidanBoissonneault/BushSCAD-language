/** Implements the solid cut behavior owned by the OCCT bridge. */

import { CutBridge } from '../cut/cut.js';

import type {
  IRExtrude,
  IRSolidCut,
  IRRevolve,
  SourceSpan,
} from '@bushscad/ir';

import { parseFaceRef } from '../../core/program-utils.js';

import {
  makeDefaultAxis,
  makeWorkplaneAxis,
  type Vec3,
} from '../../core/geometry-utils.js';

import {
  inlineRevolveToolProfileAxis,
  makeAxisFromVectors,
  transformShapeBetweenAxes,
  type SolidCutToolSource,
} from '../solid-cut-tools.js';

import { ax2Axes, workplaneFrame } from '../../topology/frame-utils.js';

import { occtError } from '../../core/occt-errors.js';

import { buildSurfaceThickenOperation } from '../../surfaces/surfaces.js';

import { aliasDeferredPartCut } from '../part-solid.js';

import type { SourceAttachmentPlane } from '../../topology/source-edge-recovery.js';

import type { GroupBuildState, OC } from '../../bridge/bridge-types.js';

export abstract class SolidCutBridge extends CutBridge {
  protected override buildSolidCutOperation(
    state: GroupBuildState,
    op: IRSolidCut,
  ): void {
    const parsed = parseFaceRef(op.from.faceRef);
    const targetShape = this.shapeForSolidCutTarget(state, parsed.objName);
    if (!targetShape) {
      throw occtError(
        `Unknown object '${parsed.objName}' for solid cut`,
        op.span,
      );
    }

    const targetAx2 = this.solidCutTargetAxis(
      state.labelMap.resolveAxis(this.oc, op.from),
      targetShape,
    );
    const toolSource = this.buildSolidCutToolSource(state, op);
    const placedTool = transformShapeBetweenAxes(
      this.oc,
      toolSource.shape,
      toolSource.sourceAx2,
      targetAx2,
      toolSource.copy,
    );
    if (toolSource.toolKind) {
      (placedTool as { _solidCutToolKind?: string })._solidCutToolKind =
        toolSource.toolKind;
    }
    const attachmentPlane = this.sourceAttachmentPlane(targetAx2);
    const result = this.applyBoolCut(targetShape, placedTool, op.span);
    state.solidCutAliases.set(op.objName, {
      targetName: parsed.objName,
      targetShape,
      toolShape: placedTool,
      resultShape: result,
      ...(toolSource.toolKind ? { toolKind: toolSource.toolKind } : {}),
    });
    this.aliasSolidCutResult(
      state,
      op,
      parsed.objName,
      result,
      placedTool,
      attachmentPlane,
    );

    if (toolSource.deleteSource)
      (toolSource.shape as { delete(): void }).delete?.();
    (toolSource.sourceAx2 as { delete(): void }).delete?.();
    (targetAx2 as { delete(): void }).delete?.();
  }

  protected override shapeForSolidCutTarget(
    state: GroupBuildState,
    targetName: string,
  ): OC | undefined {
    const component = state.partSolidAliasComponents.get(targetName);
    if (component) return state.partSolidComponents.get(component);
    return state.labelMap.getShape(targetName);
  }

  protected override aliasSolidCutResult(
    state: GroupBuildState,
    op: IRSolidCut,
    targetName: string,
    result: OC,
    regionShape: OC,
    attachmentPlane: SourceAttachmentPlane,
  ): void {
    if (state.partSolidOwner) {
      const component = state.partSolidAliasComponents.get(targetName);
      if (component) {
        state.partSolidComponents.set(component, result);
        this.registerPartSolidAliasComponent(state, targetName, result);
        aliasDeferredPartCut(
          state,
          op.objName,
          targetName,
          regionShape,
          attachmentPlane,
        );
        this.registerPartSolidAliasComponent(state, op.objName, result);
        return;
      }
    }
    this.aliasBody(state, op.objName, targetName, 'inner');
    this.replaceBody(state, targetName, result);
    const frame =
      state.bodyFrames.get(this.ownerFor(state, targetName)) ??
      workplaneFrame(state.defaultWorkplane);
    state.labelMap.register(
      this.oc,
      op.objName,
      result,
      'inner',
      frame,
      regionShape,
      attachmentPlane,
    );
  }

  protected override buildSolidCutToolSource(
    state: GroupBuildState,
    op: IRSolidCut,
  ): SolidCutToolSource {
    if (op.tool.kind === 'object') {
      this.preserveSolidCutToolComponent(state, op.tool.objName);
      const shape = this.shapeForSolidCutTool(state, op.tool.objName);
      if (!shape) {
        throw occtError(
          `solid cut: no tool object named '${op.tool.objName}'`,
          op.span,
        );
      }
      return {
        shape,
        sourceAx2: this.sourceAxisForSolidCutTool(state, op.tool.objName),
        copy: true,
        deleteSource: false,
        ...((shape as { _sourceOperationKind?: string })._sourceOperationKind
          ? {
              toolKind: (shape as { _sourceOperationKind?: string })
                ._sourceOperationKind,
            }
          : {}),
      };
    }
    return {
      ...this.buildInlineSolidToolShape(state, op.tool.operation),
      copy: true,
      deleteSource: true,
    };
  }

  protected override preserveSolidCutToolComponent(
    state: GroupBuildState,
    toolName: string,
  ): void {
    const component = state.partSolidAliasComponents.get(toolName);
    if (component) state.preservedPartComponents.add(component);
  }

  protected override shapeForSolidCutTool(
    state: GroupBuildState,
    toolName: string,
  ): OC | undefined {
    const component = state.partSolidAliasComponents.get(toolName);
    if (component) return state.partSolidComponents.get(component);
    return state.bodyShapes.get(this.ownerFor(state, toolName));
  }

  protected override sourceAxisForSolidCutTool(
    state: GroupBuildState,
    toolName: string,
  ): OC {
    const bottomAx2 = state.labelMap.resolveAxis(this.oc, {
      faceRef: `${toolName}.bottom.center`,
    }) as OC;
    const bottomAxes = ax2Axes(bottomAx2);
    bottomAx2.delete?.();
    const frame =
      state.bodyFrames.get(toolName) ??
      state.bodyFrames.get(this.ownerFor(state, toolName)) ??
      workplaneFrame(state.defaultWorkplane);
    return makeAxisFromVectors(this.oc, bottomAxes.point, frame.z, frame.x);
  }

  protected override buildInlineSolidToolShape(
    state: GroupBuildState,
    op: Extract<IRSolidCut['tool'], { kind: 'operation' }>['operation'],
  ): { shape: OC; sourceAx2: OC; toolKind?: string } {
    if (op.kind === 'extrude') {
      return this.buildInlineExtrudeToolShape(state, op);
    }
    if (op.kind === 'revolve') {
      return this.buildInlineRevolveToolShape(state, op);
    }
    if (op.kind === 'loft') {
      return { ...this.buildLoftShape(state, op), toolKind: 'loft' };
    }
    if (op.kind === 'sweep') {
      const shape = this.buildSweepSolid(
        state,
        op.sketchName,
        op.pathName,
        op.orientation,
        op.span,
      );
      const ax2 =
        state.sketchAxes.get(op.sketchName) ?? makeDefaultAxis(this.oc);
      return { shape, sourceAx2: ax2 };
    }
    return {
      shape: buildSurfaceThickenOperation(this.oc, state, op),
      sourceAx2: makeWorkplaneAxis(this.oc, state.defaultWorkplane),
    };
  }

  protected override buildInlineExtrudeToolShape(
    state: GroupBuildState,
    op: IRExtrude,
  ): { shape: OC; sourceAx2: OC } {
    const exactRegion = this.buildExactProfileRegionExtrude(
      state,
      op.sketchName,
      op.from,
      op.depth,
      op.symmetric,
      op.span,
      op.closedBodyNames,
    );
    if (exactRegion)
      return { shape: exactRegion.shape, sourceAx2: exactRegion.ax2 };
    const { sketchFace, ax2 } = this.resolveSketchFaceAndAxis(
      state,
      op.sketchName,
      op.from,
      op.span,
      op.closedBodyNames,
    );
    const placedFace = this.positionFace(sketchFace, ax2);
    if (op.closedBodyNames?.length) sketchFace.delete();
    const shape = this.applyExtrude(
      placedFace,
      ax2,
      op.depth,
      op.symmetric,
      op.span,
    );
    placedFace.delete();
    return { shape, sourceAx2: ax2 };
  }

  protected override buildInlineRevolveToolShape(
    state: GroupBuildState,
    op: IRRevolve,
  ): { shape: OC; sourceAx2: OC } {
    const sketchFace = this.sketchFaceForInlineTool(
      state,
      op.sketchName,
      op.span,
    );
    const sourceAx2 = this.sketchAxisForInlineTool(state, op.sketchName);
    const profileAx2 = inlineRevolveToolProfileAxis(this.oc, sourceAx2);
    const placedFace = this.positionInlineRevolveToolFace(
      sketchFace,
      profileAx2,
      op.radius,
    );
    const shape = this.revolveInlineToolFace(state, op, placedFace, sourceAx2);

    placedFace.delete();
    profileAx2.delete?.();
    return { shape, sourceAx2 };
  }

  protected override sketchFaceForInlineTool(
    state: GroupBuildState,
    sketchName: string,
    span: SourceSpan,
  ): OC {
    const sketchFace = state.sketchFaces.get(sketchName);
    if (!sketchFace) throw occtError(`Unknown sketch '${sketchName}'`, span);
    return sketchFace;
  }

  protected override sketchAxisForInlineTool(
    state: GroupBuildState,
    sketchName: string,
  ): OC {
    return state.sketchAxes.get(sketchName) ?? makeDefaultAxis(this.oc);
  }

  protected override positionInlineRevolveToolFace(
    sketchFace: OC,
    profileAx2: OC,
    radius: number | undefined,
  ): OC {
    const placedFace = this.positionFace(sketchFace, profileAx2);
    return this.translateInlineRevolveToolFace(placedFace, profileAx2, radius);
  }

  protected override translateInlineRevolveToolFace(
    placedFace: OC,
    profileAx2: OC,
    radius: number | undefined,
  ): OC {
    if (radius === undefined || radius === 0) return placedFace;
    return this.translateAlongSketchX(placedFace, profileAx2, radius);
  }

  protected override revolveInlineToolFace(
    state: GroupBuildState,
    op: IRRevolve,
    placedFace: OC,
    sourceAx2: OC,
  ): OC {
    const axis = this.makeRevolveAxisFromVec(
      this.revolveAxisVectors(state, op, sourceAx2),
    );
    const revol = new this.oc.BRepPrimAPI_MakeRevol_1(
      placedFace,
      axis,
      (op.angleDeg * Math.PI) / 180,
      false,
    );
    if (!revol.IsDone())
      throw occtError('Solid cut revolve tool failed', op.span);
    const shape = revol.Shape();
    axis.delete?.();
    revol.delete();
    return shape;
  }

  protected override solidCutTargetAxis(targetAx2: OC, targetShape: OC): OC {
    const axes = ax2Axes(targetAx2);
    const [cx, cy, cz] = this.shapeCenter(targetShape);
    const toCenter: Vec3 = [
      cx - axes.point[0],
      cy - axes.point[1],
      cz - axes.point[2],
    ];
    const dot =
      axes.z[0] * toCenter[0] +
      axes.z[1] * toCenter[1] +
      axes.z[2] * toCenter[2];
    targetAx2.delete?.();
    if (dot >= 0)
      return makeAxisFromVectors(this.oc, axes.point, axes.z, axes.x);
    return makeAxisFromVectors(
      this.oc,
      axes.point,
      [-axes.z[0], -axes.z[1], -axes.z[2]],
      axes.x,
    );
  }
}
