/**
 * @author Aidan Boissonneault
 * @file resolve-radial-references.ts
 * @purpose Resolves axis and source selectors for radial object operations.
 */

import type { RadialCutOp, RadialExtrudeOp } from '@bushscad/ir';
import type { Scope } from '../../../core/scope.js';
import type { State } from '../../../core/types.js';
import { resolveExpr } from '../../../references/expressions.js';
import { resolveFaceRef, resolveFromRef } from '../../../references/refs.js';

/** Resolves an explicit face-based radial axis when one is supplied. */
export function resolveRadialAxis(
  op: RadialExtrudeOp | RadialCutOp,
  scope: Scope,
  state: State,
): void {
  if (op.axis && typeof op.axis !== 'string') {
    resolveFaceRef(op.axis, scope, state, op.span, resolveExpr, 'revolve-axis');
  }
}

/** Resolves the optional source selector after all radial parameter expressions. */
export function resolveRadialFrom(
  op: RadialExtrudeOp | RadialCutOp,
  scope: Scope,
  state: State,
): void {
  if (op.from) resolveFromRef(op.from, scope, state, op.span, resolveExpr);
}
