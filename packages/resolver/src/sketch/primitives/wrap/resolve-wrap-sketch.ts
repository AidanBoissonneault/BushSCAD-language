import type { SketchDecl } from '@bushscad/ir';
import type { Scope } from '../../../core/scope.js';
import type { State } from '../../../core/types.js';
import { resolveExpr } from '../../../references/expressions.js';
import type { SketchPrimitiveResolver } from '../types.js';

/** Resolves the point input and named option expressions for wrap(). */
export const resolveWrapSketch: SketchPrimitiveResolver = (
  stmt: SketchDecl,
  scope: Scope,
  state: State,
) => {
  const primitive = stmt.primitive as Extract<
    SketchDecl['primitive'],
    { kind: 'wrapSketch' }
  >;
  resolveExpr(primitive.points, scope, state);
  for (const option of primitive.options)
    resolveExpr(option.value, scope, state);
};
