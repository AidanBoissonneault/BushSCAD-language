/** Implements the solid primitive behavior owned by the OCCT bridge. */

import { GroupDispatchBridge } from '../group-dispatch/group-dispatch.js';

import type { IRSolidPrimitive } from '@bushscad/ir';

import { buildSolidPrimitiveShape } from '../../primitives/solid-primitives.js';

import type { GroupBuildState } from '../../bridge/bridge-types.js';

export abstract class SolidPrimitiveBridge extends GroupDispatchBridge {
  protected override buildSolidPrimitiveOperation(
    state: GroupBuildState,
    op: IRSolidPrimitive,
  ): void {
    const built = buildSolidPrimitiveShape(this.oc, state, op);
    this.addBody(
      state,
      op.objName,
      built.shape,
      built.frame,
      op.material ?? null,
      op.span,
      built.attachmentPlane,
    );
  }
}
