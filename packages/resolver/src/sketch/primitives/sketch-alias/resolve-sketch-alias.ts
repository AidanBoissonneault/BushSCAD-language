import type { SketchDecl } from '@bushscad/ir';
import type { Scope } from '../../../core/scope.js';
import type { State } from '../../../core/types.js';
import type { SketchPrimitiveResolver } from '../types.js';

/** Resolves the nested primitive stored by a sketch alias. */
export const resolveSketchAlias: SketchPrimitiveResolver = (
  stmt: SketchDecl,
  _scope: Scope,
  _state: State,
  resolveNested,
) => {
  const primitive = stmt.primitive as Extract<
    SketchDecl['primitive'],
    { kind: 'sketchAlias' }
  >;
  resolveNested(primitive.primitive);
};
