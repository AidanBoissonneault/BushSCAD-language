import type { SketchDecl } from '@bushscad/ir';
import type { Scope } from '../../../core/scope.js';
import type { State } from '../../../core/types.js';
import { resolveExpr } from '../../../references/expressions.js';
import type { SketchPrimitiveResolver } from '../types.js';

/** Resolves coordinate expressions for the spline point list. */
export const resolveSplineSketch: SketchPrimitiveResolver = (
  stmt: SketchDecl,
  scope: Scope,
  state: State,
) => {
  const primitive = stmt.primitive as Extract<
    SketchDecl['primitive'],
    { kind: 'splineSketch' }
  >;
  for (const [x, y] of primitive.points) {
    resolveExpr(x, scope, state);
    resolveExpr(y, scope, state);
  }
};
