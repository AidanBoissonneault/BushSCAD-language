/** Implements the shell behavior owned by the OCCT bridge. */

import { SolidPrimitiveBridge } from '../solid-primitive/solid-primitive.js';

import type { IROp } from '@bushscad/ir';

import { buildShellOperation } from '../shell-operations.js';

import type { GroupBuildState } from '../../bridge/bridge-types.js';

export abstract class ShellBridge extends SolidPrimitiveBridge {
  protected override buildShellGroupOperation(
    state: GroupBuildState,
    op: Extract<IROp, { kind: 'shell' }>,
  ): void {
    buildShellOperation(this.oc, state, op, (name, shape) =>
      this.replaceBody(state, name, shape),
    );
  }
}
