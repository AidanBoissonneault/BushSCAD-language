/** Implements the pattern linear behavior owned by the OCCT bridge. */

import { RotateBridge } from '../rotate/rotate.js';

import type { IRPatternLinear, SourceSpan } from '@bushscad/ir';

import { workplaneFrame } from '../../topology/frame-utils.js';

import { occtError } from '../../core/occt-errors.js';

import type { GroupBuildState, OC } from '../../bridge/bridge-types.js';
import type { FaceFrame } from '../../topology/face-labels.js';
import type { MaterialAppearance } from '@bushscad/ir';

export abstract class PatternLinearBridge extends RotateBridge {
  protected override resolvePatternSource(
    state: GroupBuildState,
    objName: string,
    span: SourceSpan,
    context: string,
  ): { shape: OC; frame: FaceFrame; material: MaterialAppearance | null } {
    const shape = state.labelMap.getShape(objName);
    if (!shape)
      throw occtError(`Unknown object '${objName}' for ${context}`, span);
    const frame =
      state.bodyFrames.get(objName) ?? workplaneFrame(state.defaultWorkplane);
    const material = state.bodyMaterials.get(objName) ?? null;
    return { shape, frame, material };
  }

  protected override buildPatternLinearOperation(
    state: GroupBuildState,
    op: IRPatternLinear,
  ): void {
    const { shape, frame, material } = this.resolvePatternSource(
      state,
      op.objName,
      op.span,
      'pattern',
    );
    const oc = this.oc;
    for (let i = 0; i < op.countX; i++) {
      for (let j = 0; j < op.countY; j++) {
        if (i === 0 && j === 0) continue;
        const dx = i * op.spacingX;
        const dy = j * op.spacingY;
        const trsf = new oc.gp_Trsf_1();
        const vec = new oc.gp_Vec_4(dx, dy, 0);
        trsf.SetTranslation_1(vec);
        const copy = new oc.BRepBuilderAPI_Transform_2(
          shape,
          trsf,
          true,
        ).Shape();
        vec.delete();
        trsf.delete();
        const copyName = `${op.objName}__p${i}_${j}`;
        this.addBody(state, copyName, copy, frame, material, op.span);
      }
    }
  }
}
