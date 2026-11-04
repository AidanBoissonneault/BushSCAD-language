/** Implements the operations behavior owned by the OCCT bridge. */

import { HardwareVisualBridge } from '../../operations/hardware-visual/hardware-visual.js';

import type { IRSketch } from '@bushscad/ir';

import { profileSegmentsAreClosed } from '@bushscad/ir';

import { makeWorkplaneAxis } from '../../core/geometry-utils.js';

import { isOpenProfile } from '../../topology/frame-utils.js';

import {
  buildProfileFaceForPrimitive,
  profileFaceSegmentGroups,
} from '../../profiles/profile-faces.js';

import type { GroupBuildState } from '../../bridge/bridge-types.js';

export abstract class OperationsBridge extends HardwareVisualBridge {
  protected override buildSketchOperation(
    state: GroupBuildState,
    op: IRSketch,
  ): void {
    const ax2 = op.placement
      ? state.labelMap.resolveAxis(this.oc, op.placement)
      : makeWorkplaneAxis(this.oc, state.defaultWorkplane);
    state.sketchPrimitives.set(op.name, op.primitive);
    if (op.surfaceBound) {
      state.surfaceBoundSketches.set(op.name, op.surfaceBound);
    }
    if (op.primitive.kind === 'word' || this.isCompositeSketch(op.primitive)) {
      const face = this.buildSketchFace(op.primitive, op.span);
      state.sketchFaces.set(op.name, face);
      state.sketchAxes.set(op.name, ax2);
      return;
    }
    if (
      op.primitive.kind === 'profile' &&
      profileSegmentsAreClosed(op.primitive.segments)
    ) {
      const groups = profileFaceSegmentGroups(op.primitive);
      if (groups.length === 1) {
        state.sketchWires.set(op.name, this.buildProfileWire(groups[0]));
      }
      state.sketchFaces.set(
        op.name,
        buildProfileFaceForPrimitive(this.oc, op.primitive, op.span),
      );
      state.sketchAxes.set(op.name, ax2);
      return;
    }

    const wire = this.buildWire(op.primitive, op.span);
    state.sketchWires.set(op.name, wire);
    if (!isOpenProfile(op.primitive)) {
      const face = this.buildFaceFromWire(wire, op.primitive.kind, op.span);
      state.sketchFaces.set(op.name, face);
    }
    state.sketchAxes.set(op.name, ax2);
  }
}
