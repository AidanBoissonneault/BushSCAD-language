/**
 * @author Aidan Boissonneault
 * @file eval-geometry-assert-ir.ts
 * @purpose Evaluates geometry assert IR for the geometry in evaluator package.
 * @last-edited October 6, 2026
 */

import type {
  AssertStatement,
  Expr,
  IRAssert,
  IRAssertExpr,
} from '@bushscad/ir';
import { toSpan } from '../core/eval-context.js';
import type { EvalCtx } from '../core/eval-types.js';
import { materializeInlineObjectReference } from '../references/eval-face-serialization.js';
import { buildFitOkAssert } from './eval-fit-ok-assert.js';
import { ALL_GEOMETRY_QUERY_FNS } from './geometry-query-sets.js';

const COMPARISON_OPS = new Set(['>=', '<=', '>', '<', '==', '!=']);
const ARITHMETIC_OPS = new Set(['+', '-', '*', '/']);

/**
 * Converts an assertion expression into an IR assertion operation.
 * OCCT-deferred geometry assertions need a compact IR form, while unsupported
 * expression shapes should continue to be ignored by returning null.
 */
export function buildIRAssert(
  stmt: AssertStatement,
  ctx: EvalCtx,
): IRAssert | null {
  const cond = stmt.condition;
  if (cond.kind === 'call' && cond.name === 'fit_ok') {
    return buildFitOkAssert(stmt, cond.args, ctx);
  }

  if (cond.kind !== 'binary' || !COMPARISON_OPS.has(cond.op)) return null;

  const left = exprToIRAssertExpr(cond.left, ctx);
  const right = exprToIRAssertExpr(cond.right, ctx);
  if (!left || !right) return null;

  return {
    kind: 'assert',
    left,
    op: cond.op as IRAssert['op'],
    right,
    severity: stmt.severity,
    message: stmt.message,
    span: toSpan(stmt.span),
  };
}

/**
 * Handles expr to IR assert expr in the geometry flow.
 */
function exprToIRAssertExpr(expr: Expr, ctx: EvalCtx): IRAssertExpr | null {
  switch (expr.kind) {
    case 'number':
      return { kind: 'literal', value: expr.value };
    case 'unit':
      // Recursively unwrap unit annotations; OCCT bridge interprets degree values.
      return exprToIRAssertExpr(expr.value, ctx);
    case 'identifier':
      return identifierAssertExpr(expr, ctx);
    case 'binary':
      return binaryAssertExpr(expr, ctx);
    case 'call':
      return callAssertExpr(expr, ctx);
    case 'faceRef':
      // Calls encode a standalone face reference as an argument string.
      return null;
    default:
      return null;
  }
}

/**
 * Handles identifier assert expr in the geometry flow.
 */
function identifierAssertExpr(expr: Expr, ctx: EvalCtx): IRAssertExpr | null {
  if (expr.kind !== 'identifier') return null;
  const val = ctx.values.get(expr.name);
  return typeof val === 'number' ? { kind: 'literal', value: val } : null;
}

/**
 * Handles binary assert expr in the geometry flow.
 */
function binaryAssertExpr(expr: Expr, ctx: EvalCtx): IRAssertExpr | null {
  if (expr.kind !== 'binary' || !ARITHMETIC_OPS.has(expr.op)) return null;
  const left = exprToIRAssertExpr(expr.left, ctx);
  const right = exprToIRAssertExpr(expr.right, ctx);
  if (!left || !right) return null;
  return {
    kind: 'binary',
    op: expr.op as '+' | '-' | '*' | '/',
    left,
    right,
  };
}

/**
 * Handles call assert expr in the geometry flow.
 */
function callAssertExpr(expr: Expr, ctx: EvalCtx): IRAssertExpr | null {
  if (expr.kind !== 'call' || !ALL_GEOMETRY_QUERY_FNS.has(expr.name)) {
    return null;
  }

  const args = resolvedQueryArgs(expr.args, ctx);
  if (!args) return null;
  return { kind: 'query', fn: expr.name, args };
}

/**
 * Handles resolved query args in the geometry flow.
 */
function resolvedQueryArgs(args: Expr[], ctx: EvalCtx): string[] | null {
  const resolved = args
    .map((arg) => exprArgToString(arg, ctx))
    .filter((arg): arg is string => arg !== null);
  return resolved.length === args.length ? resolved : null;
}

/**
 * Handles expr arg to string in the geometry flow.
 */
function exprArgToString(expr: Expr, ctx: EvalCtx): string | null {
  if (expr.kind === 'identifier') return ctx.names.get(expr.name) ?? expr.name;
  if (expr.kind !== 'faceRef' || expr.chain.length === 0) return null;
  const resolved = materializeInlineObjectReference(expr, ctx);
  return resolved.chain
    .map((seg) => faceRefSegmentToString(seg, ctx))
    .join('.');
}

/**
 * Resolves the face data required by the current selector.
 */
function faceRefSegmentToString(
  seg: Expr & { kind: 'faceRef' } extends { chain: (infer Segment)[] }
    ? Segment
    : never,
  ctx: EvalCtx,
): string {
  if (seg.kind === 'name') return ctx.names.get(seg.value) ?? seg.value;
  if (seg.kind === 'edgeIntersection') {
    const suffix = seg.index === undefined ? '' : `[${seg.index}]`;
    return `(${seg.edges.join(',')})${suffix}`;
  }
  if (seg.kind === 'group') return seg.options.join('.');
  if (seg.kind === 'index') return String(seg.value);
  if (seg.kind === 'wildcard') return '*';
  return `${seg.name}.${seg.arg}`;
}
