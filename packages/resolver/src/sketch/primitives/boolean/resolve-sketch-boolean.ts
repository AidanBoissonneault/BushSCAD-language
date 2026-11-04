import type { SketchDecl } from '@bushscad/ir';
import type { Scope } from '../../../core/scope.js';
import type { State } from '../../../core/types.js';
import { validateBooleanComponentAliases } from '../../sketch-component-aliases.js';
import type { SketchPrimitiveResolver } from '../types.js';

/** Validates boolean component aliases and resolves both operands. */
export const resolveBooleanSketch: SketchPrimitiveResolver = (
  stmt: SketchDecl,
  _scope: Scope,
  state: State,
  resolveNested,
) => {
  const primitive = stmt.primitive as Extract<
    SketchDecl['primitive'],
    { kind: 'sketchBoolean' }
  >;
  validateBooleanComponentAliases(primitive, state);
  resolveNested(primitive.left);
  resolveNested(primitive.right);
};
