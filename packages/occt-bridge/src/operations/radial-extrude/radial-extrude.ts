/** Implements the radial extrude behavior owned by the OCCT bridge. */

import { SolidCutBridge } from '../solid-cut/solid-cut.js';

import type {
  IRRadialExtrude,
  IRRadialCut,
  MaterialAppearance,
  SourceSpan,
} from '@bushscad/ir';

import { faceFrameFromAx2 } from '../../topology/face-labels.js';

import { makeDefaultAxis, type Vec3 } from '../../core/geometry-utils.js';

import {
  axisPointAndDirection,
  axisPointAndLocalDirection,
} from '../../topology/frame-utils.js';

import { registerPrimitiveNamedEdgesForBody } from '../../topology/primitive-named-edge-labels.js';

import { occtError } from '../../core/occt-errors.js';

import { buildRadialStations } from '../radial-stations.js';

import type { GroupBuildState, OC } from '../../bridge/bridge-types.js';

export abstract class RadialExtrudeBridge extends SolidCutBridge {
  protected override buildRadialExtrudeOperation(
    state: GroupBuildState,
    op: IRRadialExtrude,
  ): void {
    const shape = this.buildRadialSolid(state, op, op.span);
    this.addBodyFromSketchAxis(
      state,
      op.objName,
      op.sketchName,
      shape,
      op.material ?? null,
      op.span,
    );
    registerPrimitiveNamedEdgesForBody(
      this.oc,
      state,
      op.objName,
      op.sketchName,
    );
  }

  protected override addBodyFromSketchAxis(
    state: GroupBuildState,
    objName: string,
    sketchName: string,
    shape: OC,
    material: MaterialAppearance | null,
    span?: SourceSpan,
  ): void {
    const ax2 = state.sketchAxes.get(sketchName) ?? makeDefaultAxis(this.oc);
    this.addBody(state, objName, shape, faceFrameFromAx2(ax2), material, span);
  }

  protected override buildRadialSolid(
    state: GroupBuildState,
    op: IRRadialExtrude | IRRadialCut,
    span: SourceSpan,
    cutTargetShape?: OC,
  ): OC {
    const sketchWire = this.radialSketchWire(state, op, span);
    const ax2 = this.radialSourceAxis(state, op);

    if (op.extent.kind === 'placement-bridge') {
      return this.buildRadialPlacementBridgeSolid(
        state,
        op,
        ax2,
        span,
        cutTargetShape,
      );
    }

    if (op.extent.kind !== 'angle-length') {
      throw occtError(
        `radial 'between:' extent is not yet supported by the OCCT bridge — use 'angle:' + 'length:'`,
        span,
      );
    }
    const extent = op.extent;
    this.validateRadialAngleLengthModifiers(op, span);
    const axisVec = this.radialAxisVector(state, op, ax2);
    const axialSign = this.radialAxialSign(op, axisVec, cutTargetShape);
    const stations = this.radialStations(op, extent, span);
    const wires = this.buildRadialStationWires(
      sketchWire,
      ax2,
      op,
      axisVec,
      stations,
      axialSign,
    );

    // Ruled mode (param 2 = true) — linear sections between consecutive wires.
    // Smoother (ruled=false) can fragment helical sweeps into compound solids,
    // which then mesh-extract as multiple meshes (one per sub-solid) and the
    // renderer colors each with a different palette entry.
    return this.buildRadialLoftShape(wires, span);
  }

  protected override radialSketchWire(
    state: GroupBuildState,
    op: IRRadialExtrude | IRRadialCut,
    span: SourceSpan,
  ): OC {
    const sketchWire = state.sketchWires.get(op.sketchName);
    if (!sketchWire) throw occtError(`Unknown sketch '${op.sketchName}'`, span);
    return sketchWire;
  }

  protected override radialSourceAxis(
    state: GroupBuildState,
    op: IRRadialExtrude | IRRadialCut,
  ): OC {
    return op.from
      ? state.labelMap.resolveAxis(this.oc, op.from)
      : (state.sketchAxes.get(op.sketchName) ?? makeDefaultAxis(this.oc));
  }

  protected override validateRadialAngleLengthModifiers(
    op: IRRadialExtrude | IRRadialCut,
    span: SourceSpan,
  ): void {
    if (op.twistDeg !== 0) {
      throw occtError(
        `radial 'twist:' is not yet supported by the OCCT bridge`,
        span,
      );
    }
    if (op.taperDeg !== 0) {
      throw occtError(
        `radial 'taper:' is not yet supported by the OCCT bridge`,
        span,
      );
    }
  }

  protected override radialAxisVector(
    state: GroupBuildState,
    op: IRRadialExtrude | IRRadialCut,
    ax2: OC,
  ): { point: Vec3; dir: Vec3 } {
    return typeof op.axis === 'string'
      ? axisPointAndLocalDirection(ax2, op.axis)
      : axisPointAndDirection(state.labelMap.resolveAxis(this.oc, op.axis));
  }

  protected override radialAxialSign(
    op: IRRadialExtrude | IRRadialCut,
    axisVec: { point: Vec3; dir: Vec3 },
    cutTargetShape?: OC,
  ): number {
    return cutTargetShape && op.kind === 'radial_cut'
      ? this.axisSignTowardShape(axisVec.point, axisVec.dir, cutTargetShape)
      : 1;
  }

  protected override radialStations(
    op: IRRadialExtrude | IRRadialCut,
    extent: Extract<
      (IRRadialExtrude | IRRadialCut)['extent'],
      { kind: 'angle-length' }
    >,
    span: SourceSpan,
  ): ReturnType<typeof buildRadialStations> {
    const stations = buildRadialStations({
      angleDeg: extent.angleDeg,
      lengthMm: extent.lengthMm,
      curve: op.curve,
      direction: op.direction,
      startDeg: op.startDeg,
      sections: op.sections,
    });

    if (stations.length < 2) {
      throw occtError(
        `radial sweep produced fewer than 2 distinct stations (angle=${extent.angleDeg}, length=${extent.lengthMm})`,
        span,
      );
    }
    return stations;
  }

  protected override buildRadialStationWires(
    sketchWire: OC,
    ax2: OC,
    op: IRRadialExtrude | IRRadialCut,
    axisVec: { point: Vec3; dir: Vec3 },
    stations: ReturnType<typeof buildRadialStations>,
    axialSign: number,
  ): OC[] {
    return stations.map(({ rotDeg, axialMm }) =>
      this.buildRadialStationWire(
        sketchWire,
        ax2,
        op,
        axisVec,
        rotDeg,
        axialMm,
        axialSign,
      ),
    );
  }

  protected override buildRadialStationWire(
    sketchWire: OC,
    ax2: OC,
    op: IRRadialExtrude | IRRadialCut,
    axisVec: { point: Vec3; dir: Vec3 },
    rotDeg: number,
    axialMm: number,
    axialSign: number,
  ): OC {
    let placed = this.positionFace(sketchWire, ax2);
    if (op.radius !== 0) {
      placed = this.translateAlongSketchX(placed, ax2, op.radius);
    }
    if (rotDeg !== 0) {
      placed = this.rotateShape(placed, axisVec.point, axisVec.dir, rotDeg);
    }
    if (axialMm !== 0) {
      placed = this.translateShape(
        placed,
        axisVec.dir[0] * axialMm * axialSign,
        axisVec.dir[1] * axialMm * axialSign,
        axisVec.dir[2] * axialMm * axialSign,
      );
    }
    return placed;
  }

  protected override buildRadialLoftShape(wires: OC[], span: SourceSpan): OC {
    const loft = new this.oc.BRepOffsetAPI_ThruSections(true, true, 1e-6);
    loft.CheckCompatibility?.(false);
    for (const w of wires) loft.AddWire(this.oc.TopoDS.Wire_1(w));
    loft.Build();
    if (loft.IsDone && !loft.IsDone())
      throw occtError('Radial loft failed', span);
    const shape = loft.Shape();
    for (const w of wires) (w as { delete?(): void }).delete?.();
    loft.delete?.();
    return shape;
  }
}
