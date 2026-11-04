import type { SketchDecl } from '@bushscad/ir';
import type { Scope } from '../../../core/scope.js';
import type { State } from '../../../core/types.js';
import { addError } from '../../../core/errors.js';
import { inheritSketchSegmentNames } from '../../sketch-reference-segments.js';
import type { SketchPrimitiveResolver } from '../types.js';

/** Resolves a sketch name and propagates its stable generated segment names. */
export const resolveSketchRef: SketchPrimitiveResolver = (
  stmt: SketchDecl,
  scope: Scope,
  state: State,
) => {
  const primitive = stmt.primitive as Extract<
    SketchDecl['primitive'],
    { kind: 'sketchRef' }
  >;
  if (scope.lookup(primitive.name) !== 'sketch') {
    addError(
      state,
      `Undefined sketch '${primitive.name}' in sketch expression`,
      primitive.span,
    );
    return;
  }
  inheritSketchSegmentNames(stmt.name, primitive.name, state);
};
