/**
 * @author Aidan Boissonneault
 * @file eval-geometry-query-metrics.ts
 * @purpose Evaluates geometry query metrics for the geometry in evaluator package.
 * @last-edited October 6, 2026
 */

import type { Expr } from '@bushscad/ir';
import type { EvalCtx } from '../core/eval-types.js';
import { serializeFaceRef } from '../expressions/eval-expressions.js';
import { OCCT_DEFERRED } from './geometry-query-sets.js';

/**
 * Try to evaluate a geometry query built-in at compile time using pre-computed metrics.
 * Assert evaluation can avoid emitting an OCCT assertion when dimensions are already
 * available from evaluator metrics. Queries that need real BREP geometry still defer.
 */
export function evalGeometryQuery(
  fnName: string,
  argExprs: Expr[],
  ctx: EvalCtx,
): number | null {
  if (OCCT_DEFERRED.has(fnName)) return null;

  switch (fnName) {
    case 'face_area':
      return evalFaceAreaQuery(argExprs, ctx);
    case 'bounding_box':
      // Returns volume as a proxy; actual bounding box is a tuple, not a number.
      // For assert comparisons, callers usually compare one dimension; treat as volume.
      return null;
    case 'volume':
      return evalVolumeQuery(argExprs, ctx);
    case 'wall_thickness':
      return evalWallThicknessQuery(argExprs, ctx);
    default:
      return null;
  }
}

/**
 * Evaluates face area query with the current evaluation context.
 */
function evalFaceAreaQuery(argExprs: Expr[], ctx: EvalCtx): number | null {
  if (argExprs.length < 1) return null;
  const key = exprToRefString(argExprs[0], ctx);
  if (!key) return null;
  return ctx.faceMetrics.get(key)?.area ?? null;
}

/**
 * Evaluates volume query with the current evaluation context.
 */
function evalVolumeQuery(argExprs: Expr[], ctx: EvalCtx): number | null {
  const m = solidMetricsForArg(argExprs, ctx);
  return m ? m.width * m.height * m.depth : null;
}

/**
 * Evaluates wall thickness query with the current evaluation context.
 */
function evalWallThicknessQuery(argExprs: Expr[], ctx: EvalCtx): number | null {
  const m = solidMetricsForArg(argExprs, ctx);
  return m ? Math.min(m.width, m.height, m.depth) : null;
}

/**
 * Handles expr to ref string in the geometry flow.
 */
function exprToRefString(expr: Expr, ctx: EvalCtx): string | null {
  if (expr.kind === 'faceRef') return serializeFaceRef(expr, ctx);
  if (expr.kind === 'identifier') return ctx.names.get(expr.name) ?? expr.name;
  return null;
}

/** Resolves the solid metrics for the object named by the first query argument. */
function solidMetricsForArg(argExprs: Expr[], ctx: EvalCtx) {
  if (argExprs.length < 1) return null;
  const name = exprToObjName(argExprs[0], ctx);
  if (!name) return null;
  return ctx.solidMetrics.get(name) ?? null;
}

/**
 * Handles expr to obj name in the geometry flow.
 */
function exprToObjName(expr: Expr, ctx: EvalCtx): string | null {
  if (expr.kind === 'identifier') return ctx.names.get(expr.name) ?? expr.name;
  if (expr.kind !== 'faceRef' || expr.chain.length === 0) return null;

  const first = expr.chain[0];
  return first.kind === 'name'
    ? (ctx.names.get(first.value) ?? first.value)
    : null;
}
