import type { SketchDecl } from '@bushscad/ir';
import type { Scope } from '../../../core/scope.js';
import type { State } from '../../../core/types.js';
import { resolveExpr } from '../../../references/expressions.js';
import type { SketchPrimitiveResolver } from '../types.js';

/** Resolves the child primitive and radius expression for fillet(). */
export const resolveSketchFillet: SketchPrimitiveResolver = (
  stmt: SketchDecl,
  scope: Scope,
  state: State,
  resolveNested,
) => {
  const primitive = stmt.primitive as Extract<
    SketchDecl['primitive'],
    { kind: 'sketchFillet' }
  >;
  resolveNested(primitive.primitive);
  resolveExpr(primitive.radius, scope, state);
};
