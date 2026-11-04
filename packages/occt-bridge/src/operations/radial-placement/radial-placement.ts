/** Implements the radial placement behavior owned by the OCCT bridge. */

import { RadialCutBridge } from '../radial-cut/radial-cut.js';

import type { IRRadialExtrude, IRRadialCut, SourceSpan } from '@bushscad/ir';

import {
  getEdges,
  readBounds,
  readEdgeEndpoints,
  type Vec3,
} from '../../core/geometry-utils.js';

import {
  ax2Axes,
  normalizeVec,
  projectPerpendicular,
} from '../../topology/frame-utils.js';

import { occtError } from '../../core/occt-errors.js';

import { buildThruSectionsLoft } from '../loft-operations.js';

import type { GroupBuildState, OC } from '../../bridge/bridge-types.js';

export abstract class RadialPlacementBridge extends RadialCutBridge {
  protected override buildRadialPlacementBridgeSolid(
    state: GroupBuildState,
    op: IRRadialExtrude | IRRadialCut,
    ax2: OC,
    span: SourceSpan,
    cutTargetShape?: OC,
  ): OC {
    if (op.extent.kind !== 'placement-bridge') {
      throw occtError('Expected radial placement bridge extent', span);
    }
    const pathWire = this.radialPlacementGuidePathWire(state, op.extent, span);
    if (!pathWire) {
      return this.buildAutoRadialPlacementBridgeSolid(
        state,
        op,
        ax2,
        cutTargetShape,
        span,
      );
    }
    const sketchWire = this.radialSketchWire(state, op, span);
    const profileAx2 = this.radialPlacementProfileAxis(
      pathWire,
      op,
      ax2,
      cutTargetShape,
    );
    const ownsProfileAx2 = profileAx2 !== ax2;
    const placedProfile = this.positionFace(sketchWire, profileAx2);
    if (ownsProfileAx2) (profileAx2 as { delete?(): void }).delete?.();
    return this.buildRadialPlacementPipeSolid(pathWire, placedProfile, span);
  }

  protected override radialPlacementGuidePathWire(
    state: GroupBuildState,
    extent: Extract<
      (IRRadialExtrude | IRRadialCut)['extent'],
      { kind: 'placement-bridge' }
    >,
    span: SourceSpan,
  ): OC | null {
    const pathWire = extent.guidePathName
      ? state.pathWires.get(extent.guidePathName)
      : null;
    if (!pathWire && extent.guidePathName) {
      throw occtError(
        `Unknown path '${extent.guidePathName}' for radial placement bridge`,
        span,
      );
    }
    return pathWire ?? null;
  }

  protected override radialPlacementProfileAxis(
    pathWire: OC,
    op: IRRadialExtrude | IRRadialCut,
    ax2: OC,
    cutTargetShape?: OC,
  ): OC {
    return cutTargetShape && op.kind === 'radial_cut'
      ? this.radialBridgeCutProfileAxis(pathWire, op, ax2, cutTargetShape)
      : ax2;
  }

  protected override buildRadialPlacementPipeSolid(
    pathWire: OC,
    placedProfile: OC,
    span: SourceSpan,
  ): OC {
    const pipeShell = new this.oc.BRepOffsetAPI_MakePipeShell(pathWire);
    pipeShell.Add_1(this.oc.TopoDS.Wire_1(placedProfile), false, false);
    pipeShell.SetMode_1(false);
    pipeShell.Build();
    if (!pipeShell.IsDone()) {
      throw occtError('Radial placement bridge sweep failed', span);
    }
    pipeShell.MakeSolid();
    const shape = pipeShell.Shape();
    (placedProfile as { delete?(): void }).delete?.();
    pipeShell.delete?.();
    return shape;
  }

  protected override buildAutoRadialPlacementBridgeSolid(
    state: GroupBuildState,
    op: IRRadialExtrude | IRRadialCut,
    fromAx2: OC,
    cutTargetShape: OC | undefined,
    span: SourceSpan,
  ): OC {
    if (op.extent.kind !== 'placement-bridge') {
      throw occtError('Expected radial placement bridge extent', span);
    }
    const sketchWire = state.sketchWires.get(op.sketchName);
    if (!sketchWire) {
      throw occtError(`Unknown sketch '${op.sketchName}'`, span);
    }

    const fromAxes = ax2Axes(fromAx2);
    const toAx2 = state.labelMap.resolveAxis(this.oc, op.extent.to) as OC;
    const toAxes = ax2Axes(toAx2);
    (toAx2 as { delete?(): void }).delete?.();

    const startDir = this.bridgeInteriorDirection(
      fromAxes.point,
      fromAxes.z,
      cutTargetShape,
    );
    const endInteriorDir = this.bridgeInteriorDirection(
      toAxes.point,
      toAxes.z,
      cutTargetShape,
    );
    const endDir: Vec3 = [
      -endInteriorDir[0],
      -endInteriorDir[1],
      -endInteriorDir[2],
    ];
    const points = this.buildAutoBridgeBezierPoints(
      fromAxes.point,
      startDir,
      toAxes.point,
      endDir,
      op.curve,
      cutTargetShape,
    );
    const wires = points.map(({ point, tangent, t }) => {
      const xDir = this.bridgeSectionXDirection(
        fromAxes.x,
        toAxes.x,
        tangent,
        t,
      );
      const sectionAx2 = this.makeAx2(point, tangent, xDir);
      const placed = this.positionFace(sketchWire, sectionAx2);
      (sectionAx2 as { delete?(): void }).delete?.();
      return placed;
    });

    const shape = buildThruSectionsLoft(
      this.oc,
      wires,
      'Radial placement bridge loft failed',
      span,
    );
    for (const wire of wires) (wire as { delete?(): void }).delete?.();
    return shape;
  }

  protected override radialBridgeCurveScales(
    curve: IRRadialExtrude['curve'],
  ): [number, number] {
    switch (curve.kind) {
      case 'ease-in':
        return [0.55, 1.45];
      case 'ease-out':
        return [1.45, 0.55];
      case 'ease':
      case 'ease-in-out':
        return [1.25, 1.25];
      case 'step-start':
        return [0.35, 1.65];
      case 'step-end':
        return [1.65, 0.35];
      case 'cubic-bezier':
        return [
          Math.max(0.25, Math.min(1.75, 0.5 + curve.y1)),
          Math.max(0.25, Math.min(1.75, 0.5 + (1 - curve.y2))),
        ];
      default:
        return [1, 1];
    }
  }

  protected override bridgeInteriorDirection(
    point: Vec3,
    normal: Vec3,
    targetShape: OC | undefined,
  ): Vec3 {
    const sign = targetShape
      ? this.axisSignTowardShape(point, normal, targetShape)
      : 1;
    return [normal[0] * sign, normal[1] * sign, normal[2] * sign];
  }

  protected override addScaledVec(point: Vec3, dir: Vec3, scale: number): Vec3 {
    return [
      point[0] + dir[0] * scale,
      point[1] + dir[1] * scale,
      point[2] + dir[2] * scale,
    ];
  }

  protected override distanceBetween(a: Vec3, b: Vec3): number {
    return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  }

  protected override buildAutoBridgeBezierPoints(
    start: Vec3,
    startDir: Vec3,
    end: Vec3,
    endDir: Vec3,
    curve: IRRadialExtrude['curve'],
    targetShape: OC | undefined,
  ): { point: Vec3; tangent: Vec3; t: number }[] {
    const [startScale, endScale] = this.radialBridgeCurveScales(curve);
    const distance = Math.max(1, this.distanceBetween(start, end));
    const baseHandle = distance * 0.3;
    const bounds = targetShape ? readBounds(this.oc, targetShape) : null;
    let startHandle = baseHandle * startScale;
    let endHandle = baseHandle * endScale;
    for (let i = 0; i < 8 && bounds; i++) {
      const p1 = this.addScaledVec(start, startDir, startHandle);
      const p2 = this.addScaledVec(end, endDir, -endHandle);
      if (this.pointInBounds(p1, bounds) && this.pointInBounds(p2, bounds)) {
        break;
      }
      startHandle *= 0.65;
      endHandle *= 0.65;
    }

    const p0 = start;
    const p1 = this.addScaledVec(start, startDir, startHandle);
    const p2 = this.addScaledVec(end, endDir, -endHandle);
    const p3 = end;
    const samples = 12;
    return Array.from({ length: samples + 1 }, (_, index) => {
      const t = index / samples;
      const point = this.cubicBezierPoint(p0, p1, p2, p3, t);
      const tangent =
        this.cubicBezierTangent(p0, p1, p2, p3, t) ??
        (index === samples ? endDir : startDir);
      return { point, tangent, t };
    });
  }

  protected override bridgeSectionXDirection(
    startX: Vec3,
    endX: Vec3,
    tangent: Vec3,
    t: number,
  ): Vec3 {
    const blended = normalizeVec([
      startX[0] * (1 - t) + endX[0] * t,
      startX[1] * (1 - t) + endX[1] * t,
      startX[2] * (1 - t) + endX[2] * t,
    ]);
    return (
      (blended ? projectPerpendicular(blended, tangent) : null) ??
      projectPerpendicular(startX, tangent) ??
      projectPerpendicular(endX, tangent) ??
      ([1, 0, 0] as Vec3)
    );
  }

  protected override cubicBezierPoint(
    p0: Vec3,
    p1: Vec3,
    p2: Vec3,
    p3: Vec3,
    t: number,
  ): Vec3 {
    const u = 1 - t;
    const a = u * u * u;
    const b = 3 * u * u * t;
    const c = 3 * u * t * t;
    const d = t * t * t;
    return [
      p0[0] * a + p1[0] * b + p2[0] * c + p3[0] * d,
      p0[1] * a + p1[1] * b + p2[1] * c + p3[1] * d,
      p0[2] * a + p1[2] * b + p2[2] * c + p3[2] * d,
    ];
  }

  protected override cubicBezierTangent(
    p0: Vec3,
    p1: Vec3,
    p2: Vec3,
    p3: Vec3,
    t: number,
  ): Vec3 | null {
    const u = 1 - t;
    return normalizeVec([
      3 * u * u * (p1[0] - p0[0]) +
        6 * u * t * (p2[0] - p1[0]) +
        3 * t * t * (p3[0] - p2[0]),
      3 * u * u * (p1[1] - p0[1]) +
        6 * u * t * (p2[1] - p1[1]) +
        3 * t * t * (p3[1] - p2[1]),
      3 * u * u * (p1[2] - p0[2]) +
        6 * u * t * (p2[2] - p1[2]) +
        3 * t * t * (p3[2] - p2[2]),
    ]);
  }

  protected override pointInBounds(
    point: Vec3,
    bounds: ReturnType<typeof readBounds>,
  ): boolean {
    const eps = 1e-6;
    return (
      point[0] >= bounds.xMin.current - eps &&
      point[0] <= bounds.xMax.current + eps &&
      point[1] >= bounds.yMin.current - eps &&
      point[1] <= bounds.yMax.current + eps &&
      point[2] >= bounds.zMin.current - eps &&
      point[2] <= bounds.zMax.current + eps
    );
  }

  protected override readAx2PointAndDirection(ax2: OC): {
    point: Vec3;
    dir: Vec3;
  } {
    const axes = ax2Axes(ax2);
    return { point: axes.point, dir: axes.z };
  }

  protected override axisSignTowardShape(
    point: Vec3,
    dir: Vec3,
    targetShape: OC,
  ): number {
    const [cx, cy, cz] = this.shapeCenter(targetShape);
    const dot =
      dir[0] * (cx - point[0]) +
      dir[1] * (cy - point[1]) +
      dir[2] * (cz - point[2]);
    return dot < 0 ? -1 : 1;
  }

  protected override pathStartTangent(pathWire: OC): Vec3 | null {
    const edges = getEdges(this.oc, pathWire);
    const first = edges[0];
    if (!first) return null;
    const [start, end] = readEdgeEndpoints(this.oc, first);
    return normalizeVec([
      end[0] - start[0],
      end[1] - start[1],
      end[2] - start[2],
    ]);
  }

  protected override makeAx2(point: Vec3, zDirVec: Vec3, xDirVec: Vec3): OC {
    const origin = new this.oc.gp_Pnt_3(point[0], point[1], point[2]);
    const zDir = new this.oc.gp_Dir_4(zDirVec[0], zDirVec[1], zDirVec[2]);
    const xDir = new this.oc.gp_Dir_4(xDirVec[0], xDirVec[1], xDirVec[2]);
    const ax2 = new this.oc.gp_Ax2_2(origin, zDir, xDir);
    origin.delete();
    zDir.delete();
    xDir.delete();
    return ax2;
  }
}
