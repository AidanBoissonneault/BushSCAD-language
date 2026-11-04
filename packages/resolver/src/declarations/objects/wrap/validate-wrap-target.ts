/**
 * @author Aidan Boissonneault
 * @file validate-wrap-target.ts
 * @purpose Provides object wrap resolver behavior for the declarations in resolver package.
 * @last-edited October 6, 2026
 */

import type {
  FaceRef,
  ObjDecl,
  PosRef,
  RepeatableSpatialRef,
} from '@bushscad/ir';
import { expandRepeatableSpatialRef } from '@bushscad/ir';
import { addError } from '../../../core/errors.js';
import type { State } from '../../../core/types.js';

/**
 * Validates that wrapped cuts and extrusions have only curved-face targets.
 * Wrap target validation is independent of ordinary object operand resolution
 * and is shared by both additive and subtractive wrapped operations.
 */
export function validateWrapTarget(
  operationName: 'cut' | 'extrude',
  wrap: boolean,
  from: RepeatableSpatialRef | null,
  span: ObjDecl['operation']['span'],
  state: State,
): void {
  if (wrap && !from) {
    addError(
      state,
      `wrap:true ${operationName} requires a face placement`,
      span,
    );
  }
  if (
    wrap &&
    from &&
    expandRepeatableSpatialRef(from).some((ref) => !isCurvedWrapTarget(ref))
  ) {
    addError(state, `wrap:true requires a .curved face target`, span);
  }
}

/**
 * Returns whether the input meets the `curved wrap target` condition.
 */
function isCurvedWrapTarget(ref: FaceRef | PosRef): boolean {
  if (ref.kind !== 'faceRef') return false;
  return ref.chain.some(
    (segment) => segment.kind === 'name' && segment.value === 'curved',
  );
}
