/** Implements the heal behavior owned by the OCCT bridge. */

import { ThreadBridge } from '../thread/thread.js';

import type { IRHeal } from '@bushscad/ir';

import { occtError } from '../../core/occt-errors.js';

import type { GroupBuildState } from '../../bridge/bridge-types.js';

export abstract class HealBridge extends ThreadBridge {
  protected override buildHealOperation(
    state: GroupBuildState,
    op: IRHeal,
  ): void {
    const shape = state.bodyShapes.get(op.target);
    if (!shape) {
      throw occtError(`heal: no shape named '${op.target}'`, op.span);
    }
    const fixer = new this.oc.ShapeFix_Shape_2(shape);
    fixer.SetPrecision(op.tolerance);
    fixer.SetMinTolerance(op.tolerance / 10);
    fixer.SetMaxTolerance(op.tolerance * 10);
    fixer.Perform(new this.oc.Message_ProgressRange_1());
    const healed = fixer.Shape();
    if (!healed || healed.IsNull()) {
      throw occtError(`heal: shape fixing failed for '${op.target}'`, op.span);
    }
    state.bodyShapes.set(op.target, healed);
    this.reregisterShape(state, op.target, healed);
  }
}
