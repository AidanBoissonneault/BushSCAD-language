import type { SketchDecl } from '@bushscad/ir';
import type { Scope } from '../../core/scope.js';
import type { State } from '../../core/types.js';

/** Primitive union owned by a sketch declaration. */
export type SketchPrimitive = SketchDecl['primitive'];

/** Callback used to resolve recursively nested sketch primitives. */
export type NestedSketchResolver = (primitive: SketchPrimitive) => void;

/** Contract implemented by each primitive-specific resolver. */
export type SketchPrimitiveResolver = (
  stmt: SketchDecl,
  scope: Scope,
  state: State,
  resolveNested: NestedSketchResolver,
) => void;
