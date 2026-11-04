/** Implements the thread behavior owned by the OCCT bridge. */

import { SurfaceThickenBridge } from '../surface-thicken/surface-thicken.js';

import type { IROp } from '@bushscad/ir';

import { buildThreadOperation } from '../../threads/thread-geometry.js';

import type { GroupBuildState } from '../../bridge/bridge-types.js';

export abstract class ThreadBridge extends SurfaceThickenBridge {
  protected override buildThreadGroupOperation(
    state: GroupBuildState,
    op: Extract<IROp, { kind: 'thread' }>,
  ): void {
    buildThreadOperation(
      this.oc,
      state,
      op,
      (name) => this.ownerFor(state, name),
      (name, shape) => this.replaceBody(state, name, shape),
    );
  }
}
