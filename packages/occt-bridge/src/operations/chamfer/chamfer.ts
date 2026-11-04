/** Implements the chamfer behavior owned by the OCCT bridge. */

import { FilletBridge } from '../fillet/fillet.js';

import type { SourceSpan } from '@bushscad/ir';

import { isOcctError, occtError } from '../../core/occt-errors.js';

import {
  describeBlendException,
  describeBlendPhaseFailure,
  describeBlendRejection,
} from '../blend-diagnostics.js';

import type { EdgeSelection, OC } from '../../bridge/bridge-types.js';

export abstract class ChamferBridge extends FilletBridge {
  protected override applyChamferBatch(
    shape: OC,
    selections: EdgeSelection[],
    owner: string,
    span: SourceSpan,
  ): OC {
    const oc = this.oc;
    let chamferer: OC | null = null;
    try {
      chamferer = new oc.BRepFilletAPI_MakeChamfer(shape);
      for (const selection of selections)
        chamferer.Add_2(selection.value, selection.edge);
      chamferer.Build();
      if (!chamferer.IsDone()) {
        throw occtError(
          describeBlendPhaseFailure(
            'chamfer',
            owner,
            selections,
            describeBlendRejection('chamfer', selections),
          ),
          span,
        );
      }
      return chamferer.Shape();
    } catch (err) {
      if (isOcctError(err)) throw err;
      throw occtError(
        describeBlendPhaseFailure(
          'chamfer',
          owner,
          selections,
          describeBlendException('chamfer', selections, err),
        ),
        span,
      );
    } finally {
      chamferer?.delete?.();
    }
  }
}
