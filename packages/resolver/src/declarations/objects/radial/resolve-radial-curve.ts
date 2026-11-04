/**
 * @author Aidan Boissonneault
 * @file resolve-radial-curve.ts
 * @purpose Resolves curve parameters used by radial object operations.
 */

import type { RadialCutOp, RadialExtrudeOp } from '@bushscad/ir';
import type { Scope } from '../../../core/scope.js';
import type { State } from '../../../core/types.js';
import { resolveExpr } from '../../../references/expressions.js';

/**
 * Resolves cubic Bezier coordinates when the selected radial curve needs them.
 *
 * Why:
 * Curve-specific expression work stays separate from the shared radial
 * operation orchestration so new curve forms have a clear home.
 */
export function resolveRadialCurve(
  op: RadialExtrudeOp | RadialCutOp,
  scope: Scope,
  state: State,
): void {
  if (op.curve.kind !== 'cubic-bezier') return;

  resolveExpr(op.curve.x1, scope, state);
  resolveExpr(op.curve.y1, scope, state);
  resolveExpr(op.curve.x2, scope, state);
  resolveExpr(op.curve.y2, scope, state);
}
