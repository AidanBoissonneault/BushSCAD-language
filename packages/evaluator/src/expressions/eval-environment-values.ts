/**
 * @author Aidan Boissonneault
 * @file eval-environment-values.ts
 * @purpose Evaluates environment values for the expressions in evaluator package.
 * @last-edited October 6, 2026
 */

import type { EvalCtx, EvalValue } from '../core/eval-types.js';
import type { Literal } from '@bushscad/ir';

/** Converts a supported source length unit to millimetres. */
export function unitToMm(unit: 'mm' | 'cm' | 'm' | 'in' | 'ft'): number {
  switch (unit) {
    case 'mm':
      return 1;
    case 'cm':
      return 10;
    case 'm':
      return 1000;
    case 'in':
      return 25.4;
    case 'ft':
      return 304.8;
  }
}

/** Evaluates an environment declaration, preferring a caller override. */
export function evalEnvDecl(
  stmt: { name: string; fallback: Literal },
  ctx: EvalCtx,
): EvalValue {
  if (ctx.envOverrides.has(stmt.name)) {
    return ctx.envOverrides.get(stmt.name) as EvalValue;
  }
  return evalLiteral(stmt.fallback);
}

/**
 * Evaluates literal with the current evaluation context.
 */
function evalLiteral(literal: Literal): EvalValue {
  switch (literal.kind) {
    case 'number':
    case 'string':
    case 'bool':
      return literal.value;
    case 'list':
      return literal.items.map((item) => evalLiteralExpr(item));
  }
}

/**
 * Evaluates literal expr with the current evaluation context.
 */
function evalLiteralExpr(expr: {
  kind: string;
  value?: unknown;
  items?: unknown[];
}): EvalValue {
  if (
    expr.kind === 'number' ||
    expr.kind === 'string' ||
    expr.kind === 'bool'
  ) {
    return expr.value as EvalValue;
  }
  if (expr.kind === 'list' && Array.isArray(expr.items)) {
    return (expr.items as { kind: string; value?: unknown }[]).map(
      evalLiteralExpr,
    );
  }
  return 0;
}
