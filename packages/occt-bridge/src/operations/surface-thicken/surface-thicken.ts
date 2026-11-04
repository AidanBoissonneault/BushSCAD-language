/** Implements the surface thicken behavior owned by the OCCT bridge. */

import { ShellBridge } from '../shell/shell.js';

import type { IRSurfaceThicken } from '@bushscad/ir';

import { workplaneFrame } from '../../topology/frame-utils.js';

import { buildSurfaceThickenOperation } from '../../surfaces/surfaces.js';

import type { GroupBuildState } from '../../bridge/bridge-types.js';

export abstract class SurfaceThickenBridge extends ShellBridge {
  protected override buildSurfaceThickenOperation(
    state: GroupBuildState,
    op: IRSurfaceThicken,
  ): void {
    const shape = buildSurfaceThickenOperation(this.oc, state, op);
    this.addBody(
      state,
      op.objName,
      shape,
      workplaneFrame(state.defaultWorkplane),
      op.material ?? null,
      op.span,
    );
  }
}
