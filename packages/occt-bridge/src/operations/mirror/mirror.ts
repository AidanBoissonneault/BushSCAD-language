/** Implements the mirror behavior owned by the OCCT bridge. */

import { PatternRadialBridge } from '../pattern-radial/pattern-radial.js';

import type { IRMirror, IRMirrorPlane } from '@bushscad/ir';

import { readBounds } from '../../core/geometry-utils.js';

import type { GroupBuildState, OC } from '../../bridge/bridge-types.js';

export abstract class MirrorBridge extends PatternRadialBridge {
  protected override buildMirrorOperation(
    state: GroupBuildState,
    op: IRMirror,
  ): void {
    const { shape, frame, material } = this.resolvePatternSource(
      state,
      op.objName,
      op.span,
      'mirror',
    );
    const oc = this.oc;
    const trsf = new oc.gp_Trsf_1();
    const mirrorAx2 = this.resolveMirrorPlane(state, op.across, op.objName);
    trsf.SetMirror_3(mirrorAx2);
    const copy = new oc.BRepBuilderAPI_Transform_2(shape, trsf, true).Shape();
    trsf.delete();
    const mirrorName = `${op.objName}__m`;
    this.addBody(state, mirrorName, copy, frame, material, op.span);
  }

  protected override resolveMirrorPlane(
    state: GroupBuildState,
    plane: IRMirrorPlane,
    objName: string,
  ): OC {
    const oc = this.oc;
    if (plane.kind === 'world') {
      const origin = new oc.gp_Pnt_3(0, 0, 0);
      let normal: OC;
      if (plane.axis === 'x') normal = new oc.gp_Dir_4(1, 0, 0);
      else if (plane.axis === 'y') normal = new oc.gp_Dir_4(0, 1, 0);
      else normal = new oc.gp_Dir_4(0, 0, 1);
      const ax2 = new oc.gp_Ax2_3(origin, normal);
      origin.delete();
      normal.delete();
      return ax2;
    }
    if (plane.kind === 'faceRef') {
      return state.labelMap.resolveAxis(oc, { faceRef: plane.ref });
    }
    // 'named' — use AABB centroid of the target object as mirror plane origin
    const shape = state.labelMap.getShape(objName);
    const bounds = shape ? readBounds(oc, shape) : null;
    const cx = bounds ? (bounds.xMin.current + bounds.xMax.current) / 2 : 0;
    const cy = bounds ? (bounds.yMin.current + bounds.yMax.current) / 2 : 0;
    const cz = bounds ? (bounds.zMin.current + bounds.zMax.current) / 2 : 0;
    const origin = new oc.gp_Pnt_3(cx, cy, cz);
    const normal = new oc.gp_Dir_4(0, 0, 1);
    const ax2 = new oc.gp_Ax2_3(origin, normal);
    origin.delete();
    normal.delete();
    return ax2;
  }
}
