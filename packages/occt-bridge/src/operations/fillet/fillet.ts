/** Implements the fillet behavior owned by the OCCT bridge. */

import { BlendsBridge } from '../blends/blends.js';

import type { SourceSpan } from '@bushscad/ir';

import { FaceLabelMap } from '../../topology/face-labels.js';

import { isOcctError, occtError } from '../../core/occt-errors.js';

import {
  describeBlendException,
  describeBlendPhaseFailure,
  describeFilletFailure,
} from '../blend-diagnostics.js';

import type { EdgeSelection, OC } from '../../bridge/bridge-types.js';

export abstract class FilletBridge extends BlendsBridge {
  protected override expandFilletTangentSelections(
    owner: string,
    shape: OC,
    selections: EdgeSelection[],
    labelMap: FaceLabelMap,
  ): EdgeSelection[] {
    const expanded = [...selections];
    const queued = [...selections];
    const candidates = this.targetScopedTangentCandidates(
      shape,
      selections,
      labelMap,
    );

    while (queued.length > 0) {
      const current = queued.shift() as EdgeSelection;
      this.expandTangentSelection(owner, current, candidates, expanded, queued);
    }

    return expanded;
  }

  protected override applyFilletBatch(
    shape: OC,
    selections: EdgeSelection[],
    owner: string,
    span: SourceSpan,
  ): OC {
    const oc = this.oc;
    let filler: OC | null = null;
    try {
      filler = new oc.BRepFilletAPI_MakeFillet(
        shape,
        oc.ChFi3d_FilletShape?.ChFi3d_Rational,
      );
      for (const selection of selections)
        filler.Add_2(selection.value, selection.edge);
      filler.Build();
      if (!filler.IsDone()) {
        throw occtError(
          describeBlendPhaseFailure(
            'fillet',
            owner,
            selections,
            describeFilletFailure(filler, selections),
          ),
          span,
        );
      }
      return filler.Shape();
    } catch (err) {
      if (isOcctError(err)) throw err;
      throw occtError(
        describeBlendPhaseFailure(
          'fillet',
          owner,
          selections,
          describeBlendException('fillet', selections, err),
        ),
        span,
      );
    } finally {
      filler?.delete?.();
    }
  }
}
