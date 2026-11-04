import type { SketchDecl } from '@bushscad/ir';
import type { Scope } from '../../../core/scope.js';
import type { State } from '../../../core/types.js';
import { resolvePathSketch } from '../../resolve-path-sketch.js';
import type { SketchPrimitiveResolver } from '../types.js';

/** Resolves path segments, dimensions, and references for path(). */
export const resolvePathSketchPrimitive: SketchPrimitiveResolver = (
  stmt: SketchDecl,
  scope: Scope,
  state: State,
) => {
  const primitive = stmt.primitive as Extract<
    SketchDecl['primitive'],
    { kind: 'pathSketch' }
  >;
  resolvePathSketch(primitive, stmt.name, scope, state);
};
