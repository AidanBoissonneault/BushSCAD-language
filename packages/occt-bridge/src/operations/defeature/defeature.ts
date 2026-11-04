/** Implements the defeature behavior owned by the OCCT bridge. */

import { HealBridge } from '../heal/heal.js';

import type { IRDefeature } from '@bushscad/ir';

import { occtError } from '../../core/occt-errors.js';

import type { GroupBuildState, OC } from '../../bridge/bridge-types.js';

export abstract class DefeatureBridge extends HealBridge {
  protected override buildDefeatureOperation(
    state: GroupBuildState,
    op: IRDefeature,
  ): void {
    const shape = state.bodyShapes.get(op.target);
    if (!shape) {
      throw occtError(`defeature: no shape named '${op.target}'`, op.span);
    }
    const defeaturing = new this.oc.BRepAlgoAPI_Defeaturing();
    defeaturing.SetShape(shape);
    defeaturing.SetRunParallel(false);
    const faceCount = this.addDefeatureFacesToRemove(
      defeaturing,
      shape,
      op.threshold,
    );

    // Nothing matched the threshold — leave the shape untouched.
    if (faceCount === 0) return;

    const result = this.buildDefeaturedShape(defeaturing, op);
    state.bodyShapes.set(op.target, result);
    this.reregisterShape(state, op.target, result);
  }

  protected override buildDefeaturedShape(
    defeaturing: OC,
    op: IRDefeature,
  ): OC {
    defeaturing.Build();
    if (!defeaturing.IsDone()) {
      throw occtError(
        `defeature: operation failed for '${op.target}'`,
        op.span,
      );
    }
    const result = defeaturing.Shape();
    if (!result || result.IsNull()) {
      throw occtError(
        `defeature: produced null shape for '${op.target}'`,
        op.span,
      );
    }
    return result;
  }

  protected override addDefeatureFacesToRemove(
    defeaturing: OC,
    shape: OC,
    threshold: number,
  ): number {
    const explorer = new this.oc.TopExp_Explorer_2(
      shape,
      this.oc.TopAbs_ShapeEnum.TopAbs_FACE,
      this.oc.TopAbs_ShapeEnum.TopAbs_SHAPE,
    );
    let faceCount = 0;
    while (explorer.More()) {
      const face = this.oc.TopoDS.Face_1(explorer.Current());
      if (this.isDefeatureCandidateFace(face, threshold)) {
        defeaturing.AddFaceToRemove(face);
        faceCount++;
      }
      explorer.Next();
    }
    return faceCount;
  }

  protected override isDefeatureCandidateFace(
    face: OC,
    threshold: number,
  ): boolean {
    if (!this.isCylinderFace(face)) return false;
    const radius = this.extractCylinderRadius(face);
    return radius > 0 && radius <= threshold;
  }
}
