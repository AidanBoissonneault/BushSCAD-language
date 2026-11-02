/**
 * @author Aidan Boissonneault
 * @file eval-geometry-assert-values.ts
 * @purpose Evaluates geometry assert values for the geometry in evaluator package.
 * @last-edited October 6, 2026
 */

import type { Expr } from '@bushscad/ir';
import type { EvalCtx } from '../core/eval-types.js';
import { evalAssertBinaryValue } from '../expressions/eval-binary.js';
import { evalGeometryQuery } from './eval-geometry-query-metrics.js';
import { ALL_GEOMETRY_QUERY_FNS } from './geometry-query-sets.js';

/**
 * Assert value accepts number and boolean.
 */
type AssertValue = number | boolean;

/**
 * Try to evaluate an assert condition at compile time.
 * Deterministic asserts can fail during evaluation, while geometry-dependent
 * assertions must be emitted for the OCCT bridge to validate later.
 */
export function tryEvalAssertCondition(
  condition: Expr,
  ctx: EvalCtx,
): boolean | null {
  const val = tryEvalAssertExpr(condition, ctx);
  if (val === null) return null;
  return Boolean(val);
}

/**
 * Try to evaluate any expression for assert purposes.
 * Assert expressions permit a narrower value set than general BushSCAD
 * expressions, and returning null preserves deferred geometry behavior.
 */
function tryEvalAssertExpr(expr: Expr, ctx: EvalCtx): AssertValue | null {
  switch (expr.kind) {
    case 'number':
      return expr.value;
    case 'bool':
      return expr.value;
    case 'unit':
      // Evaluates unit-annotated number (degrees, mm, etc.) by using its numeric value.
      return tryEvalAssertExpr(expr.value, ctx);
    case 'identifier':
      return evalIdentifierAssertExpr(expr, ctx);
    case 'binary':
      return evalBinaryAssertExpr(expr, ctx);
    case 'unary':
      return evalUnaryAssertExpr(expr, ctx);
    case 'call':
      return evalCallAssertExpr(expr, ctx);
    default:
      return null;
  }
}

/**
 * Evaluates identifier assert expr with the current evaluation context.
 */
function evalIdentifierAssertExpr(
  expr: Expr,
  ctx: EvalCtx,
): AssertValue | null {
  if (expr.kind !== 'identifier') return null;
  const val = ctx.values.get(expr.name);
  return typeof val === 'number' || typeof val === 'boolean' ? val : null;
}

/**
 * Evaluates binary assert expr with the current evaluation context.
 */
function evalBinaryAssertExpr(expr: Expr, ctx: EvalCtx): AssertValue | null {
  if (expr.kind !== 'binary') return null;
  const left = tryEvalAssertExpr(expr.left, ctx);
  const right = tryEvalAssertExpr(expr.right, ctx);
  if (left === null || right === null) return null;
  return evalAssertBinaryValue(expr.op, left, right);
}

/**
 * Evaluates unary assert expr with the current evaluation context.
 */
function evalUnaryAssertExpr(expr: Expr, ctx: EvalCtx): AssertValue | null {
  if (expr.kind !== 'unary') return null;
  const value = tryEvalAssertExpr(expr.operand, ctx);
  if (value === null) return null;
  if (expr.op === '!') return !value;
  return typeof value === 'number' ? -value : null;
}

/**
 * Evaluates call assert expr with the current evaluation context.
 */
function evalCallAssertExpr(expr: Expr, ctx: EvalCtx): number | null {
  if (expr.kind !== 'call' || !ALL_GEOMETRY_QUERY_FNS.has(expr.name)) {
    return null;
  }
  return evalGeometryQuery(expr.name, expr.args, ctx);
}
