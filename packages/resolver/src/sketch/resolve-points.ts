/**
 * @author Aidan Boissonneault
 * @file resolve-points.ts
 * @purpose Resolves points for the sketch in resolver package.
 * @last-edited October 6, 2026
 */

import type { Expr } from '@bushscad/ir';
import type { Scope } from '../core/scope.js';
import type { State } from '../core/types.js';
import { resolveExpr } from '../references/expressions.js';

/**
 * Resolves both expressions in a 2D sketch point.
 * Profile and path sketches share point-shaped expressions for dimensions,
 * closed-body declarations, and path geometry. Keeping this in one place keeps
 * resolver behavior identical across those sketch syntaxes.
 */
export function resolveSketchPoint(
  point: [Expr, Expr],
  scope: Scope,
  state: State,
): void {
  resolveExpr(point[0], scope, state);
  resolveExpr(point[1], scope, state);
}
