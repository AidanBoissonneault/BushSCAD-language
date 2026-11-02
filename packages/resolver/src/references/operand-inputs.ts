/**
 * @author Aidan Boissonneault
 * @file operand-inputs.ts
 * @purpose Provides operand inputs behavior for the references in resolver package.
 * @last-edited October 6, 2026
 */

import type {
  ObjectInput,
  PathInput,
  SketchInput,
  ThroughTarget,
} from '@bushscad/ir';
import type { Scope } from '../core/scope.js';
import type { State } from '../core/types.js';
import { addError } from '../core/errors.js';
import { resolveExpr } from './expressions.js';
import { resolveSketch } from '../sketch/sketch.js';
export { resolveSurfaceInput } from '../geometry/surface.js';

/**
 * Resolves a sketch operand by validating either the named sketch or all
 * expressions inside an inline sketch primitive.
 */
export function resolveSketchInput(
  input: SketchInput,
  scope: Scope,
  state: State,
  context: string,
  supportsBodySelection = false,
): void {
  if (input.kind === 'namedSketch') {
    if (scope.lookup(input.name) === null) {
      addError(
        state,
        `Undefined sketch '${input.name}' in ${context}`,
        input.span,
      );
    }
    return;
  }
  if (input.kind === 'namedSketchBody' || input.kind === 'sketchBodyList') {
    if (scope.lookup(input.sketchName) === null) {
      addError(
        state,
        `Undefined sketch '${input.sketchName}' in ${context}`,
        input.span,
      );
    }
    if (!supportsBodySelection) {
      addError(
        state,
        `Sketch body selection is not supported in ${context}`,
        input.span,
      );
    }
    return;
  }
  if (input.kind === 'sketchList') {
    for (const item of input.items)
      resolveSketchInput(item, scope, state, context, supportsBodySelection);
    return;
  }
  resolveSketch(
    {
      kind: 'sketch',
      name: '__inline_sketch__',
      primitive: input.primitive,
      span: input.span,
    },
    scope,
    state,
  );
}

/** Resolves a path operand by name or inline path primitive expressions. */
export function resolvePathInput(
  input: PathInput,
  scope: Scope,
  state: State,
  context: string,
): void {
  if (input.kind === 'namedPath') {
    if (scope.lookup(input.name) !== 'path') {
      addError(
        state,
        `Undefined path '${input.name}' in ${context}`,
        input.span,
      );
    }
    return;
  }
  for (const point of input.primitive.points) {
    resolveExpr(point.x, scope, state);
    resolveExpr(point.y, scope, state);
    resolveExpr(point.z, scope, state);
  }
}

/** Resolves a named object operand; inline object operations are handled by caller. */
export function resolveNamedObjectInput(
  input: ObjectInput,
  scope: Scope,
  state: State,
  context: string,
): void {
  if (input.kind === 'namedObject' && scope.lookup(input.name) !== 'obj') {
    addError(
      state,
      `Undefined object '${input.name}' in ${context}`,
      input.span,
    );
  }
}

/** Reports an error if a named `through` target does not resolve in scope. */
export function resolveThroughTarget(
  through: ThroughTarget,
  scope: Scope,
  state: State,
  context: string,
): void {
  if (
    through?.kind === 'namedThrough' &&
    scope.lookup(through.name) !== 'obj'
  ) {
    addError(
      state,
      `Undefined object '${through.name}' in ${context}`,
      through.span,
    );
  }
}
