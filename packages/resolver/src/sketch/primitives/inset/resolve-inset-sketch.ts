import type { SketchDecl } from '@bushscad/ir';
import type { Scope } from '../../../core/scope.js';
import type { State } from '../../../core/types.js';
import { resolveExpr } from '../../../references/expressions.js';
import type { SketchPrimitiveResolver } from '../types.js';

/** Resolves the shared and side-specific offsets for inset(). */
export const resolveInsetSketch: SketchPrimitiveResolver = (
  stmt: SketchDecl,
  scope: Scope,
  state: State,
) => {
  const primitive = stmt.primitive as Extract<
    SketchDecl['primitive'],
    { kind: 'inset' }
  >;
  if (primitive.all) resolveExpr(primitive.all, scope, state);
  if (primitive.x) resolveExpr(primitive.x, scope, state);
  if (primitive.y) resolveExpr(primitive.y, scope, state);
  if (primitive.top) resolveExpr(primitive.top, scope, state);
  if (primitive.bottom) resolveExpr(primitive.bottom, scope, state);
  if (primitive.sides) resolveExpr(primitive.sides, scope, state);
};
