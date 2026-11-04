import type { SketchDecl } from '@bushscad/ir';
import type { Scope } from '../../../core/scope.js';
import type { State } from '../../../core/types.js';
import { resolveExpr } from '../../../references/expressions.js';
import type { SketchPrimitiveResolver } from '../types.js';

/** Resolves base and height for triangle(). */
export const resolveTriangleSketch: SketchPrimitiveResolver = (
  stmt: SketchDecl,
  scope: Scope,
  state: State,
) => {
  const primitive = stmt.primitive as Extract<
    SketchDecl['primitive'],
    { kind: 'triangle' }
  >;
  resolveExpr(primitive.base, scope, state);
  resolveExpr(primitive.height, scope, state);
};
