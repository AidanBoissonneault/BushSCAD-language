/** Implements the rotate behavior owned by the OCCT bridge. */

import { WrapBridge } from '../wrap/wrap.js';

import type { IRRotate } from '@bushscad/ir';

import { type Vec3 } from '../../core/geometry-utils.js';

import {
  axisPointAndDirection,
  cardinalAxis,
  rotateFrame,
  workplaneFrame,
} from '../../topology/frame-utils.js';

import { occtError } from '../../core/occt-errors.js';

import type { GroupBuildState, OC } from '../../bridge/bridge-types.js';

export abstract class RotateBridge extends WrapBridge {
  protected override buildRotateOperation(
    state: GroupBuildState,
    op: IRRotate,
  ): void {
    const deferredComponent = state.partSolidOwner
      ? state.partSolidAliasComponents.get(op.target)
      : undefined;
    if (
      deferredComponent &&
      deferredComponent !== state.partSolidOwner &&
      state.partSolidComponents.has(deferredComponent)
    ) {
      this.rotateDeferredPartComponent(state, op, deferredComponent);
      return;
    }

    const owner = this.ownerFor(state, op.target);
    const shape =
      state.labelMap.getShape(owner) ?? state.labelMap.getShape(op.target);
    if (!shape)
      throw occtError(`Unknown object '${op.target}' for rotate`, op.span);

    const rotated = this.rotateShapeForOperation(state, op, shape);
    state.bodyFrames.set(
      owner,
      rotateFrame(
        state.bodyFrames.get(owner) ?? workplaneFrame(state.defaultWorkplane),
        rotated.axis.dir,
        op.angleDeg,
      ),
    );
    this.replaceBody(state, owner, rotated.shape);
  }

  protected override rotateShapeForOperation(
    state: GroupBuildState,
    op: IRRotate,
    shape: OC,
  ): { shape: OC; axis: { point: Vec3; dir: Vec3 } } {
    const axis = this.rotationAxis(state, op);
    return {
      shape: this.rotateShape(shape, axis.point, axis.dir, op.angleDeg),
      axis,
    };
  }

  protected override rotateDeferredPartComponent(
    state: GroupBuildState,
    op: IRRotate,
    component: string,
  ): void {
    const shape = state.partSolidComponents.get(component);
    if (!shape)
      throw occtError(`Unknown object '${op.target}' for rotate`, op.span);

    const rotated = this.rotateShapeForOperation(state, op, shape);
    const frame =
      state.bodyFrames.get(component) ??
      state.bodyFrames.get(op.target) ??
      workplaneFrame(state.defaultWorkplane);
    const rotatedFrame = rotateFrame(frame, rotated.axis.dir, op.angleDeg);
    state.bodyFrames.set(component, rotatedFrame);
    for (const [alias, aliasComponent] of state.partSolidAliasComponents) {
      if (aliasComponent === component)
        state.bodyFrames.set(alias, rotatedFrame);
    }
    this.replaceDeferredPartComponent(state, op.target, rotated.shape);
  }

  protected override rotationAxis(
    state: GroupBuildState,
    op: IRRotate,
  ): { point: Vec3; dir: Vec3 } {
    if (typeof op.around === 'string') {
      return {
        point: [0, 0, 0],
        dir: cardinalAxis(op.around),
      };
    }
    const ax2 = state.labelMap.resolveAxis(this.oc, op.around);
    return axisPointAndDirection(ax2);
  }
}
