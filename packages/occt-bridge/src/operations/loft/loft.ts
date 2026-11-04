/** Implements the loft behavior owned by the OCCT bridge. */

import { RevolveBridge } from '../revolve/revolve.js';

import type { IRLoft } from '@bushscad/ir';

import { faceFrameFromAx2 } from '../../topology/face-labels.js';

import {
  makeDefaultAxis,
  makeWorkplaneAxis,
  getEdges,
  readEdgeEndpoints,
  type Vec3,
} from '../../core/geometry-utils.js';

import {
  axisDirection,
  ax2Axes,
  crossVec,
  normalizeVec,
} from '../../topology/frame-utils.js';

import { registerPrimitiveNamedEdgesForBody } from '../../topology/primitive-named-edge-labels.js';

import { occtError } from '../../core/occt-errors.js';

import { buildThruSectionsLoft } from '../loft-operations.js';

import type { GroupBuildState, OC } from '../../bridge/bridge-types.js';

export abstract class LoftBridge extends RevolveBridge {
  protected override buildLoftOperation(
    state: GroupBuildState,
    op: IRLoft,
  ): void {
    const { shape: movedShape, sourceAx2: baseAx2 } = this.buildLoftShape(
      state,
      op,
    );
    (movedShape as { _sourceOperationKind?: string })._sourceOperationKind =
      'loft';
    this.addBody(
      state,
      op.objName,
      movedShape,
      faceFrameFromAx2(baseAx2),
      op.material ?? null,
      op.span,
    );
    for (const sketchName of op.sketchNames) {
      registerPrimitiveNamedEdgesForBody(
        this.oc,
        state,
        op.objName,
        sketchName,
      );
    }
  }

  protected override buildLoftShape(
    state: GroupBuildState,
    op: IRLoft,
  ): { shape: OC; sourceAx2: OC } {
    // Build loft in canonical workplane space, then rigidly transform to instance placement.
    // This keeps the loft's shape independent of where it is mounted.
    const baseAx2 =
      state.sketchAxes.get(op.sketchNames[0]) ?? makeDefaultAxis(this.oc);
    const loftWorkplane = op.guideWorkplane ?? state.defaultWorkplane;
    const wpAx2 = makeWorkplaneAxis(this.oc, loftWorkplane);

    let shape: OC;
    if (op.guide) {
      shape = this.applyGuidedLoft(state, op, wpAx2);
    } else {
      const wires = op.sketchNames.map((name, index) =>
        this.positionLoftWire(state, name, index, op, wpAx2),
      );
      shape = this.applyThruSectionsLoft(op, wires);
    }

    const fromAx3 = new this.oc.gp_Ax3_2(wpAx2);
    const toAx3 = new this.oc.gp_Ax3_2(baseAx2);
    const trsf = new this.oc.gp_Trsf_1();
    trsf.SetDisplacement(fromAx3, toAx3);
    const movedShape = new this.oc.BRepBuilderAPI_Transform_2(
      shape,
      trsf,
      false,
    ).Shape();
    shape.delete?.();
    [fromAx3, toAx3, trsf, wpAx2].forEach((o) => o.delete?.());
    return { shape: movedShape, sourceAx2: baseAx2 };
  }

  protected override positionLoftWire(
    state: GroupBuildState,
    sketchName: string,
    index: number,
    op: IRLoft,
    wpAx2: OC,
  ): OC {
    const wire = state.sketchWires.get(sketchName);
    if (!wire) throw occtError(`Unknown sketch '${sketchName}'`, op.span);
    const placed = this.positionFace(wire, wpAx2);
    if (index === 0 || op.sketchNames.length <= 1) return placed;

    const dir = axisDirection(wpAx2);
    const offset = (op.height * index) / (op.sketchNames.length - 1);
    return this.translateShape(
      placed,
      dir[0] * offset,
      dir[1] * offset,
      dir[2] * offset,
    );
  }

  protected override applyThruSectionsLoft(op: IRLoft, wires: OC[]): OC {
    return buildThruSectionsLoft(this.oc, wires, 'Loft failed', op.span);
  }

  protected override applyGuidedLoft(
    state: GroupBuildState,
    op: IRLoft,
    wpAx2: OC,
  ): OC {
    const guideWire = state.sketchWires.get(op.guide!);
    if (!guideWire)
      throw occtError(`Unknown guide sketch '${op.guide}'`, op.span);

    // Build guide axis so guide y-coord maps to the workplane stacking direction (wpAx2 normal).
    // guideNormal = cross(wpX, wpZ) ensures yDir = cross(guideNormal, wpX) = wpZ = stackDir.
    const wpAxes = ax2Axes(wpAx2);
    const lateralDir = wpAxes.x;
    const stackDir = wpAxes.z;
    const guideNormal =
      normalizeVec(crossVec(lateralDir, stackDir)) ?? ([0, -1, 0] as Vec3);

    const gOrigin = new this.oc.gp_Pnt_3(0, 0, 0);
    const gNormal = new this.oc.gp_Dir_4(...guideNormal);
    const gXDir = new this.oc.gp_Dir_4(...lateralDir);
    const guideAx2 = new this.oc.gp_Ax2_2(gOrigin, gNormal, gXDir);
    gOrigin.delete();
    gNormal.delete();
    gXDir.delete();

    const posGuide = this.positionFace(guideWire, guideAx2);
    guideAx2.delete?.();

    let guideStart: Vec3 = [0, 0, 0];
    let guideEnd: Vec3 = [0, 0, 0];
    try {
      const guideEdges = getEdges(this.oc, posGuide);
      if (guideEdges.length > 0) {
        [guideStart] = readEdgeEndpoints(this.oc, guideEdges[0]);
        [, guideEnd] = readEdgeEndpoints(
          this.oc,
          guideEdges[guideEdges.length - 1],
        );
      }
    } catch {
      /* empty */
    }
    posGuide.delete?.();

    const n = op.sketchNames.length;
    const wires = op.sketchNames.map((sketchName, index) => {
      const wire = state.sketchWires.get(sketchName);
      if (!wire) throw occtError(`Unknown sketch '${sketchName}'`, op.span);
      const t = n <= 1 ? 0 : index / (n - 1);
      // Relative offset from guide start so index=0 gets zero displacement.
      const tx = t * (guideEnd[0] - guideStart[0]);
      const ty = t * (guideEnd[1] - guideStart[1]);
      const tz = t * (guideEnd[2] - guideStart[2]);
      const placed = this.positionFace(wire, wpAx2);
      return this.translateShape(placed, tx, ty, tz);
    });
    return this.applyThruSectionsLoft(op, wires);
  }
}
