import type { SketchDecl } from '@bushscad/ir';
import type { Scope } from '../../../core/scope.js';
import type { State } from '../../../core/types.js';
import { resolveExpr } from '../../../references/expressions.js';
import type { SketchPrimitiveResolver } from '../types.js';

/** Resolves the text, size, and optional font expressions for word(). */
export const resolveWordSketch: SketchPrimitiveResolver = (
  stmt: SketchDecl,
  scope: Scope,
  state: State,
) => {
  const primitive = stmt.primitive as Extract<
    SketchDecl['primitive'],
    { kind: 'word' }
  >;
  resolveExpr(primitive.text, scope, state);
  resolveExpr(primitive.size, scope, state);
  if (primitive.font) resolveExpr(primitive.font, scope, state);
};
