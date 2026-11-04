/**
 * @author Aidan Boissonneault
 * @file resolve-radial-parameters.ts
 * @purpose Resolves optional scalar and section parameters for radial operations.
 */

import type { RadialCutOp, RadialExtrudeOp } from '@bushscad/ir';
import type { Scope } from '../../../core/scope.js';
import type { State } from '../../../core/types.js';
import { resolveExpr } from '../../../references/expressions.js';

/**
 * Resolves the optional expressions shared by radial extrusion and cut calls.
 *
 * Why:
 * Keeping the common scalar and section parameters together gives radial
 * argument validation one focused owner apart from extent and curve handling.
 */
export function resolveRadialParameters(
  op: RadialExtrudeOp | RadialCutOp,
  scope: Scope,
  state: State,
): void {
  if (op.start) resolveExpr(op.start, scope, state);
  if (op.twist) resolveExpr(op.twist, scope, state);
  if (op.taper) resolveExpr(op.taper, scope, state);
  if (op.radius) resolveExpr(op.radius, scope, state);
  if (op.sections.kind === 'expr') resolveExpr(op.sections.value, scope, state);
}
