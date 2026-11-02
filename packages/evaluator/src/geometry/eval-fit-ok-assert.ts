/**
 * @author Aidan Boissonneault
 * @file eval-fit-ok-assert.ts
 * @purpose Evaluates fit ok assert for the geometry in evaluator package.
 * @last-edited October 6, 2026
 */

import type {
  AssertStatement,
  Expr,
  IRAssert,
  IRAssertExpr,
} from '@bushscad/ir';
import { addError, toSpan } from '../core/eval-context.js';
import type { EvalCtx } from '../core/eval-types.js';
import { resolveFitOk } from '../objects/eval-fit.js';

/**
 * Expand a fit_ok() assertion into the distance/clearance assertion consumed by IR.
 * fit_ok is language sugar over resolved fit declarations; keeping the expansion
 * isolated avoids mixing fit resolution with generic assert-expression conversion.
 */
export function buildFitOkAssert(
  stmt: AssertStatement,
  args: Expr[],
  ctx: EvalCtx,
): IRAssert | null {
  if (args.length !== 2) {
    addFitArgCountError(stmt, ctx);
    return null;
  }

  const fitName = identifierName(args[0]);
  const targetName = resolvedIdentifierName(args[1], ctx);
  if (!fitName || !targetName) {
    addError(ctx, `fit_ok arguments must be identifiers`, stmt.span);
    return null;
  }

  const resolved = resolveFitOk(fitName, targetName, ctx, stmt.span);
  if (!resolved) return null;

  const absOffset = Math.abs(resolved.resolvedOffsetMm);
  const { left, op, message } = fitAssertParts(
    fitName,
    targetName,
    resolved.isInterference,
    absOffset,
    ctx,
  );

  return {
    kind: 'assert',
    left,
    op,
    right: { kind: 'literal', value: absOffset },
    severity: stmt.severity,
    message: stmt.message ?? message,
    span: toSpan(stmt.span),
  };
}

/**
 * Adds fit arg count error to its owning collection.
 */
function addFitArgCountError(stmt: AssertStatement, ctx: EvalCtx): void {
  addError(
    ctx,
    `fit_ok requires exactly 2 arguments: fit_ok(fitName, targetName)`,
    stmt.span,
  );
}

/**
 * Handles identifier name in the geometry flow.
 */
function identifierName(expr: Expr): string | null {
  return expr.kind === 'identifier' ? expr.name : null;
}

/**
 * Handles resolved identifier name in the geometry flow.
 */
function resolvedIdentifierName(expr: Expr, ctx: EvalCtx): string | null {
  return expr.kind === 'identifier'
    ? (ctx.names.get(expr.name) ?? expr.name)
    : null;
}

/**
 * Handles fit assert parts in the geometry flow.
 */
function fitAssertParts(
  fitName: string,
  targetName: string,
  isInterference: boolean,
  absOffset: number,
  ctx: EvalCtx,
): { left: IRAssertExpr; op: IRAssert['op']; message: string } {
  if (isInterference) {
    return {
      left: fitQueryExpr('clearance', fitName, targetName, ctx),
      op: '<=',
      message: `fit '${fitName}' interference not satisfied (expected <= ${absOffset} mm)`,
    };
  }

  return {
    left: fitQueryExpr('distance', fitName, targetName, ctx),
    op: '>=',
    message: `fit '${fitName}' clearance not satisfied (expected >= ${absOffset} mm)`,
  };
}

/**
 * Handles fit query expr in the geometry flow.
 */
function fitQueryExpr(
  fn: string,
  fitName: string,
  targetName: string,
  ctx: EvalCtx,
): IRAssertExpr {
  return {
    kind: 'query',
    fn,
    args: [ctx.names.get(fitName) ?? fitName, targetName],
  };
}
