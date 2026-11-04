import type { SketchDecl } from '@bushscad/ir';
import type { Scope } from '../../../core/scope.js';
import type { State } from '../../../core/types.js';
import { resolveExpr } from '../../../references/expressions.js';
import type { SketchPrimitiveResolver } from '../types.js';

/** Resolves width, height, and corner radius for roundrect(). */
export const resolveRoundRectSketch: SketchPrimitiveResolver = (
  stmt: SketchDecl,
  scope: Scope,
  state: State,
) => {
  const primitive = stmt.primitive as Extract<
    SketchDecl['primitive'],
    { kind: 'roundrect' }
  >;
  resolveExpr(primitive.width, scope, state);
  resolveExpr(primitive.height, scope, state);
  resolveExpr(primitive.radius, scope, state);
};
