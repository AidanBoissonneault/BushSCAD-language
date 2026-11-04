import type { ObjDecl } from '@bushscad/ir';
import type { Scope } from '../../../core/scope.js';
import type { State } from '../../../core/types.js';
import { addError } from '../../../core/errors.js';
import { resolveExpr } from '../../../references/expressions.js';
import { resolveSketchInput } from '../../../references/operand-inputs.js';
import {
  namedSketchInputs,
  registerObjectProfileSegments,
} from '../profile-segments/profile-segments.js';

/**
 * Resolves loft obj against the current scope and reports unresolved references.
 */
export function resolveLoftObj(
  stmt: ObjDecl,
  scope: Scope,
  state: State,
): void {
  const op = stmt.operation as Extract<ObjDecl['operation'], { kind: 'loft' }>;
  if (op.sketches.length < 2) {
    addError(state, `loft requires at least two profile sketches`, op.span);
  }
  for (const sketch of op.sketches) {
    resolveSketchInput(sketch, scope, state, 'loft');
  }
  resolveExpr(op.height, scope, state);
  resolveLoftGuide(op, scope, state);
  registerObjectProfileSegments(
    stmt.name,
    namedSketchInputs(op.sketches),
    state,
  );
}

/**
 * Resolves loft guide against the current scope and reports unresolved references.
 */
function resolveLoftGuide(
  op: Extract<ObjDecl['operation'], { kind: 'loft' }>,
  scope: Scope,
  state: State,
): void {
  if (
    op.guide?.kind === 'namedSketch' &&
    scope.lookup(op.guide.name) === null
  ) {
    addError(
      state,
      `Undefined guide sketch '${op.guide.name}' in loft`,
      op.guide.span,
    );
  } else if (op.guide !== null) {
    resolveSketchInput(op.guide, scope, state, 'loft guide');
  }
}
