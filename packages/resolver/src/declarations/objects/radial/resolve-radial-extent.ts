/**
 * @author Aidan Boissonneault
 * @file resolve-radial-extent.ts
 * @purpose Resolves extent forms used by radial object operations.
 */

import type { RadialCutOp, RadialExtrudeOp } from '@bushscad/ir';
import type { Scope } from '../../../core/scope.js';
import type { State } from '../../../core/types.js';
import { addError } from '../../../core/errors.js';
import { resolveExpr } from '../../../references/expressions.js';
import { resolveFromRef } from '../../../references/refs.js';

/**
 * Resolves radial extent against the current scope and reports unresolved references.
 */
export function resolveRadialExtent(
  op: RadialExtrudeOp | RadialCutOp,
  scope: Scope,
  state: State,
): void {
  if (op.extent.kind === 'angle-length') {
    resolveExpr(op.extent.angle, scope, state);
    resolveExpr(op.extent.length, scope, state);
  } else if (op.extent.kind === 'between') {
    resolveFromRef(op.extent.a, scope, state, op.span, resolveExpr);
    resolveFromRef(op.extent.b, scope, state, op.span, resolveExpr);
  } else {
    resolveFromRef(op.extent.from, scope, state, op.span, resolveExpr);
    resolveFromRef(op.extent.to, scope, state, op.span, resolveExpr);
    if (op.extent.along && scope.lookup(op.extent.along) !== 'path') {
      addError(
        state,
        `Undefined path '${op.extent.along}' in radial operation`,
        op.span,
      );
    }
  }
}
