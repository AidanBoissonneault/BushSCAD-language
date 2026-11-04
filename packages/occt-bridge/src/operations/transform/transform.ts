/** Implements the transform behavior owned by the OCCT bridge. */

import { MirrorBridge } from '../mirror/mirror.js';

import type { IRTransform } from '@bushscad/ir';

import {
  axisPointAndDirection,
  cardinalAxis,
  rotateFrame,
} from '../../topology/frame-utils.js';

import { occtError } from '../../core/occt-errors.js';

import { replaceDeferredPartComponent } from '../part-solid-transform.js';

import type { GroupBuildState, OC } from '../../bridge/bridge-types.js';

export abstract class TransformBridge extends MirrorBridge {
  protected override buildTransformOperation(
    state: GroupBuildState,
    op: IRTransform,
  ): void {
    const shape = state.labelMap.getShape(op.objName);
    if (!shape)
      throw occtError(`Unknown object '${op.objName}' for transform`, op.span);
    const oc = this.oc;
    let result: OC;
    if (op.operation.kind === 'translate') {
      result = this.translateShape(
        shape,
        op.operation.x,
        op.operation.y,
        op.operation.z,
      );
    } else if (op.operation.kind === 'rotate') {
      const around = op.operation.around;
      const axis =
        typeof around === 'string'
          ? {
              point: [0, 0, 0] as [number, number, number],
              dir: cardinalAxis(around),
            }
          : axisPointAndDirection(state.labelMap.resolveAxis(oc, around));
      result = this.rotateShape(
        shape,
        axis.point,
        axis.dir,
        op.operation.angleDeg,
      );
      const frame = state.bodyFrames.get(op.objName);
      if (frame) {
        state.bodyFrames.set(
          op.objName,
          rotateFrame(frame, axis.dir, op.operation.angleDeg),
        );
      }
    } else {
      const trsf = new oc.gp_Trsf_1();
      trsf.SetScaleFactor(op.operation.factor);
      result = new oc.BRepBuilderAPI_Transform_2(shape, trsf, true).Shape();
      trsf.delete();
    }
    if (
      replaceDeferredPartComponent(
        state,
        op.objName,
        result,
        (buildState, alias, aliasShape) =>
          this.registerPartSolidAliasComponent(buildState, alias, aliasShape),
      )
    ) {
      return;
    }
    this.replaceBody(state, op.objName, result);
  }
}
