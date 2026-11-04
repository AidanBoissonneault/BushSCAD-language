import type { SketchDecl } from '@bushscad/ir';
import type { Scope } from '../../../core/scope.js';
import type { State } from '../../../core/types.js';
import { resolveExpr } from '../../../references/expressions.js';
import type { SketchPrimitiveResolver } from '../types.js';

/** Resolves the nested primitive and x/y values for sketch placement. */
export const resolveSketchAt: SketchPrimitiveResolver = (
  stmt: SketchDecl,
  scope: Scope,
  state: State,
  resolveNested,
) => {
  const primitive = stmt.primitive as Extract<
    SketchDecl['primitive'],
    { kind: 'sketchAt' }
  >;
  resolveNested(primitive.primitive);
  resolveExpr(primitive.x, scope, state);
  resolveExpr(primitive.y, scope, state);
};
