import type { SketchDecl } from '@bushscad/ir';
import type { Scope } from '../../../core/scope.js';
import type { State } from '../../../core/types.js';
import type { SketchPrimitiveResolver } from '../types.js';

/** Resolves the child geometry wrapped by construction(). */
export const resolveSketchConstruction: SketchPrimitiveResolver = (
  stmt: SketchDecl,
  _scope: Scope,
  _state: State,
  resolveNested,
) => {
  const primitive = stmt.primitive as Extract<
    SketchDecl['primitive'],
    { kind: 'sketchConstruction' }
  >;
  resolveNested(primitive.primitive);
};
