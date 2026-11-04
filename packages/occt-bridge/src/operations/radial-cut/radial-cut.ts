/** Implements the radial cut behavior owned by the OCCT bridge. */

import { RadialExtrudeBridge } from '../radial-extrude/radial-extrude.js';

import type { IRRadialCut } from '@bushscad/ir';

import { parseFaceRef } from '../../core/program-utils.js';

import { type Vec3 } from '../../core/geometry-utils.js';

import { projectPerpendicular } from '../../topology/frame-utils.js';

import { occtError } from '../../core/occt-errors.js';

import type { GroupBuildState, OC } from '../../bridge/bridge-types.js';

export abstract class RadialCutBridge extends RadialExtrudeBridge {
  protected override buildRadialCutOperation(
    state: GroupBuildState,
    op: IRRadialCut,
  ): void {
    const parsed = parseFaceRef(op.from.faceRef);
    const targetShape = state.labelMap.getShape(parsed.objName);
    if (!targetShape)
      throw occtError(
        `Unknown object '${parsed.objName}' for radial_cut`,
        op.span,
      );
    const tool = this.buildRadialSolid(state, op, op.span, targetShape);
    const result = this.applyBoolCut(targetShape, tool as OC, op.span);
    this.aliasBody(state, op.objName, parsed.objName, 'inner');
    this.replaceBody(state, parsed.objName, result);
    (tool as { delete?(): void }).delete?.();
  }

  protected override radialBridgeCutProfileAxis(
    pathWire: OC,
    op: IRRadialCut,
    ax2: OC,
    targetShape: OC,
  ): OC {
    if (op.extent.kind !== 'placement-bridge') return ax2;
    const tangent = this.pathStartTangent(pathWire);
    if (!tangent) return ax2;

    const axis = this.readAx2PointAndDirection(ax2);
    const normal = axis.dir;
    const inward = this.axisSignTowardShape(axis.point, normal, targetShape);
    const inwardVec: Vec3 = [
      normal[0] * inward,
      normal[1] * inward,
      normal[2] * inward,
    ];
    const xDir = projectPerpendicular(inwardVec, tangent);
    if (!xDir) return ax2;
    return this.makeAx2(axis.point, tangent, xDir);
  }
}
