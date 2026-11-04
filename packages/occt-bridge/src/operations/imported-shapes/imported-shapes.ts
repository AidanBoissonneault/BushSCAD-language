/** Implements the imported shapes behavior owned by the OCCT bridge. */

import { DefeatureBridge } from '../defeature/defeature.js';

import type { SourceSpan } from '@bushscad/ir';

import { workplaneFrame } from '../../topology/frame-utils.js';

import { reregisterSourceShape } from '../imported-ref-shapes.js';

import { occtError } from '../../core/occt-errors.js';

import type { GroupBuildState, OC } from '../../bridge/bridge-types.js';

export abstract class ImportedShapesBridge extends DefeatureBridge {
  protected override declareShapeSource(
    state: GroupBuildState,
    name: string,
    span: SourceSpan,
  ): void {
    const component = state.partSolidAliasComponents.get(name);
    const shape = component
      ? state.partSolidComponents.get(component)
      : (state.bodyShapes.get(this.ownerFor(state, name)) ??
        state.bodyShapes.get(name));
    if (!shape) {
      throw occtError(`ref: no shape named '${name}'`, span);
    }

    state.declaredShapeNames.add(name);
    state.declaredShapeNames.add(this.ownerFor(state, name));
    if (component) state.declaredShapeNames.add(component);

    const frame =
      state.bodyFrames.get(name) ??
      state.bodyFrames.get(this.ownerFor(state, name)) ??
      workplaneFrame(state.defaultWorkplane);
    const edgeMode = state.bodyEdgeModes.get(name) ?? 'outer';
    state.labelMap.register(this.oc, name, shape, edgeMode, frame);
    state.globalLabels.register(this.oc, name, shape, edgeMode, frame);
  }

  protected override reregisterShape(
    state: GroupBuildState,
    name: string,
    shape: OC,
  ): void {
    reregisterSourceShape(this.oc, state, name, shape);
  }
}
