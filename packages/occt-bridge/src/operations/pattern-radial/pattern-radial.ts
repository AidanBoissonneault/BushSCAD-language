/** Implements the pattern radial behavior owned by the OCCT bridge. */

import { PatternLinearBridge } from '../pattern-linear/pattern-linear.js';

import type { IRPatternRadial } from '@bushscad/ir';

import {
  axisPointAndDirection,
  rotateFrame,
} from '../../topology/frame-utils.js';

import type { GroupBuildState } from '../../bridge/bridge-types.js';

export abstract class PatternRadialBridge extends PatternLinearBridge {
  protected override buildPatternRadialOperation(
    state: GroupBuildState,
    op: IRPatternRadial,
  ): void {
    const { shape, frame, material } = this.resolvePatternSource(
      state,
      op.objName,
      op.span,
      'radial pattern',
    );
    const ax2 = state.labelMap.resolveAxis(this.oc, { faceRef: op.aroundRef });
    const { point: axisPoint, dir: axisDir } = axisPointAndDirection(ax2);
    const angleStep = 360 / op.count;
    for (let i = 1; i < op.count; i++) {
      const angleDeg = i * angleStep;
      const copy = this.rotateShapeCopy(shape, axisPoint, axisDir, angleDeg);
      const copyName = `${op.objName}__r${i}`;
      const copyFrame = rotateFrame(frame, axisDir, angleDeg);
      this.addBody(state, copyName, copy, copyFrame, material, op.span);
    }
  }
}
