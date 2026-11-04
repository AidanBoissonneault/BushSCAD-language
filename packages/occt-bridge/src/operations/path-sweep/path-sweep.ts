/** Implements the path sweep behavior owned by the OCCT bridge. */

import { ProgramBridge } from '../../export/program/program.js';

import type { IRPath, IRSweep, IRSweepCut, SourceSpan } from '@bushscad/ir';

import { parseFaceRef } from '../../core/program-utils.js';

import { occtError } from '../../core/occt-errors.js';

import type { GroupBuildState, OC } from '../../bridge/bridge-types.js';

export abstract class PathSweepBridge extends ProgramBridge {
  protected override buildPathOperation(
    state: GroupBuildState,
    op: IRPath,
  ): void {
    const oc = this.oc;
    const { points } = op.primitive;
    if (points.length < 2)
      throw occtError(`Path '${op.name}' needs at least 2 points`, op.span);

    if (op.primitive.kind === 'polyline' && points.length === 2) {
      // Straight 2-point line — single edge, no corner issues
      const a = points[0],
        b = points[1];
      const pa = new oc.gp_Pnt_3(a.x, a.y, a.z);
      const pb = new oc.gp_Pnt_3(b.x, b.y, b.z);
      const edge = new oc.BRepBuilderAPI_MakeEdge_3(pa, pb).Edge();
      this.storeBuiltPathWire(
        state,
        op.name,
        edge,
        `Polyline path '${op.name}' failed`,
        op.span,
      );
      pa.delete();
      pb.delete();
    } else {
      // Multi-segment polyline or spline: use B-spline through points.
      // Sharp corner wires produce inverted transition faces in MakePipeShell;
      // a smooth B-spline through the same points avoids the C0 discontinuity.
      const ptArr = new oc.TColgp_Array1OfPnt_2(1, points.length);
      for (let i = 0; i < points.length; i++) {
        const pt = points[i];
        ptArr.SetValue(i + 1, new oc.gp_Pnt_3(pt.x, pt.y, pt.z));
      }
      const continuity = oc.GeomAbs_Shape?.GeomAbs_C2 ?? oc.GeomAbs_C2 ?? 5;
      const interp = new oc.GeomAPI_PointsToBSpline_2(
        ptArr,
        3,
        8,
        continuity,
        1e-3,
      );
      if (!interp.IsDone())
        throw occtError(`Spline path '${op.name}' failed`, op.span);
      const bspline = interp.Curve();
      const curveHandle = new oc.Handle_Geom_Curve_2(bspline.get());
      const edge = new oc.BRepBuilderAPI_MakeEdge_24(curveHandle).Edge();
      curveHandle.delete();
      this.storeBuiltPathWire(
        state,
        op.name,
        edge,
        `Spline wire '${op.name}' failed`,
        op.span,
      );
      ptArr.delete();
    }
  }

  protected override storeBuiltPathWire(
    state: GroupBuildState,
    name: string,
    edge: OC,
    failureMessage: string,
    span: SourceSpan,
  ): void {
    const wb = new this.oc.BRepBuilderAPI_MakeWire_2(edge);
    if (!wb.IsDone()) throw occtError(failureMessage, span);
    state.pathWires.set(name, wb.Wire());
    wb.delete();
  }

  protected override buildSweepSolid(
    state: GroupBuildState,
    sketchName: string,
    pathName: string,
    orientation: string,
    span: SourceSpan,
  ): OC {
    const oc = this.oc;
    const pathWire = state.pathWires.get(pathName);
    if (!pathWire) throw occtError(`Unknown path '${pathName}'`, span);
    const profileWire = state.sketchWires.get(sketchName);
    if (!profileWire) throw occtError(`Unknown sketch '${sketchName}'`, span);

    const pipeShell = new oc.BRepOffsetAPI_MakePipeShell(pathWire);
    // RightCorner (1) creates proper miter joints at polyline corners — prevents inside-out faces
    pipeShell.Add_1(profileWire, false, false);
    if (orientation === 'fixed') {
      pipeShell.SetMode_1(false);
    } else if (orientation === 'binormal') {
      const zDir = new oc.gp_Dir_4(0, 0, 1);
      pipeShell.SetMode_3(zDir);
      zDir.delete();
    }
    pipeShell.Build();
    if (!pipeShell.IsDone()) {
      throw occtError('Sweep failed', span);
    }
    pipeShell.MakeSolid();
    const shape = pipeShell.Shape();
    pipeShell.delete();
    return shape;
  }

  protected override buildSweepOperation(
    state: GroupBuildState,
    op: IRSweep,
  ): void {
    const shape = this.buildSweepSolid(
      state,
      op.sketchName,
      op.pathName,
      op.orientation,
      op.span,
    );
    this.addBodyFromSketchAxis(
      state,
      op.objName,
      op.sketchName,
      shape,
      op.material ?? null,
      op.span,
    );
  }

  protected override buildSweepCutOperation(
    state: GroupBuildState,
    op: IRSweepCut,
  ): void {
    const sweepShape = this.buildSweepSolid(
      state,
      op.sketchName,
      op.pathName,
      op.orientation,
      op.span,
    );
    const parsed = parseFaceRef(op.from.faceRef);
    const targetShape = state.labelMap.getShape(parsed.objName);
    if (!targetShape)
      throw occtError(
        `sweep_cut: target body '${parsed.objName}' not built yet`,
        op.span,
      );
    const result = this.applyBoolCut(targetShape, sweepShape, op.span);
    (sweepShape as { delete(): void }).delete();
    this.aliasBody(state, op.objName, parsed.objName, 'inner');
    this.replaceBody(state, parsed.objName, result);
  }
}
