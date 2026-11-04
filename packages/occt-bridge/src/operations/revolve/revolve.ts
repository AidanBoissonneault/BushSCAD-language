/** Implements the revolve behavior owned by the OCCT bridge. */

import { RadialPlacementBridge } from '../radial-placement/radial-placement.js';

import type { IRRevolve } from '@bushscad/ir';

import { faceFrameFromAx2 } from '../../topology/face-labels.js';

import type { FaceFrame } from '../../topology/face-labels.js';

import { makeDefaultAxis, type Vec3 } from '../../core/geometry-utils.js';

import {
  axisPointAndDirection,
  axisPointAndLocalDirection,
  ax2Axes,
  frameFromPlantNormal,
  localVectorToWorld,
  revolvePlantLocalNormal,
} from '../../topology/frame-utils.js';

import { registerPrimitiveNamedEdgesForBody } from '../../topology/primitive-named-edge-labels.js';

import { occtError } from '../../core/occt-errors.js';

import type { GroupBuildState, OC } from '../../bridge/bridge-types.js';

export abstract class RevolveBridge extends RadialPlacementBridge {
  protected override buildRevolveOperation(
    state: GroupBuildState,
    op: IRRevolve,
  ): void {
    const ax2 = state.sketchAxes.get(op.sketchName) ?? makeDefaultAxis(this.oc);
    const shape = this.buildRevolveShape(state, op);
    this.addBody(
      state,
      op.objName,
      shape,
      this.revolveBodyFrame(state, op, ax2),
      op.material ?? null,
      op.span,
    );
    registerPrimitiveNamedEdgesForBody(
      this.oc,
      state,
      op.objName,
      op.sketchName,
      { revolveAxis: this.revolveAxisVectors(state, op, ax2) },
    );
  }

  protected override buildRevolveShape(
    state: GroupBuildState,
    op: IRRevolve,
  ): OC {
    const sketchFace = state.sketchFaces.get(op.sketchName);
    if (!sketchFace)
      throw occtError(`Unknown sketch '${op.sketchName}'`, op.span);
    const ax2 = state.sketchAxes.get(op.sketchName) ?? makeDefaultAxis(this.oc);
    let placedFace = this.positionFace(sketchFace, ax2);
    if (op.radius !== undefined && op.radius !== 0) {
      placedFace = this.translateAlongSketchX(placedFace, ax2, op.radius);
    }
    const revolveAxisVec = this.revolveAxisVectors(state, op, ax2);
    const axis = this.makeRevolveAxisFromVec(revolveAxisVec);
    const revol = new this.oc.BRepPrimAPI_MakeRevol_1(
      placedFace,
      axis,
      (op.angleDeg * Math.PI) / 180,
      false,
    );
    if (!revol.IsDone()) throw occtError('Revolve failed', op.span);
    const shape = revol.Shape();
    placedFace.delete();
    axis.delete?.();
    revol.delete();
    void revolveAxisVec;
    return shape;
  }

  protected override translateAlongSketchX(
    face: OC,
    ax2: OC,
    radius: number,
  ): OC {
    const axis = ax2 as Record<string, () => OC>;
    const xDir = axis.XDirection() as Record<string, () => number>;
    const dx = xDir.X() * radius;
    const dy = xDir.Y() * radius;
    const dz = xDir.Z() * radius;
    (xDir as unknown as { delete(): void }).delete();
    return this.translateShape(face, dx, dy, dz);
  }

  protected override revolveAxisVectors(
    state: GroupBuildState,
    op: IRRevolve,
    ax2: OC,
  ): { point: Vec3; dir: Vec3 } {
    return typeof op.around === 'string'
      ? axisPointAndLocalDirection(ax2, op.around)
      : axisPointAndDirection(state.labelMap.resolveAxis(this.oc, op.around));
  }

  protected override revolveBodyFrame(
    state: GroupBuildState,
    op: IRRevolve,
    ax2: OC,
  ): FaceFrame {
    if (typeof op.around !== 'string') return faceFrameFromAx2(ax2);
    const prim = state.sketchPrimitives.get(op.sketchName);
    const localPlantNormal = prim
      ? revolvePlantLocalNormal(prim, op.around)
      : null;
    if (!localPlantNormal) return faceFrameFromAx2(ax2);
    const axes = ax2Axes(ax2);
    const worldPlantNormal = localVectorToWorld(localPlantNormal, axes);
    return frameFromPlantNormal(worldPlantNormal, axes);
  }

  protected override makeRevolveAxisFromVec(axis: {
    point: Vec3;
    dir: Vec3;
  }): OC {
    const pnt = new this.oc.gp_Pnt_3(
      axis.point[0],
      axis.point[1],
      axis.point[2],
    );
    const dir = new this.oc.gp_Dir_4(axis.dir[0], axis.dir[1], axis.dir[2]);
    const ax1 = new this.oc.gp_Ax1_2(pnt, dir);
    pnt.delete();
    dir.delete();
    return ax1;
  }

  protected override translateShape(
    shape: OC,
    dx: number,
    dy: number,
    dz: number,
  ): OC {
    const trsf = new this.oc.gp_Trsf_1();
    const vec = new this.oc.gp_Vec_4(dx, dy, dz);
    trsf.SetTranslation_1(vec);
    const moved = new this.oc.BRepBuilderAPI_Transform_2(
      shape,
      trsf,
      false,
    ).Shape();
    shape.delete?.();
    trsf.delete();
    vec.delete();
    return moved;
  }
}
