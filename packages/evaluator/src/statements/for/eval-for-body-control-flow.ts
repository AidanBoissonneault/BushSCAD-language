/**
 * Evaluates a for-loop body for each iterator binding.
 */
import type { ForStatement } from '@bushscad/ir';
import { childCtx, fresh } from '../../core/eval-context.js';
import type { Deferred, EvalCtx, EvalValue } from '../../core/eval-types.js';
import { evalBool, evalNum } from '../../expressions/eval-expressions.js';
import { getIterations } from '../../expressions/eval-iterators.js';
import { collectBodyLocalNames } from '../eval-body-local-names.js';
import {
  collectAutoOccurrences,
  iteratorGridSize,
  resolveWithinPlan,
  type AutoOccurrence,
  type WithinPlan,
} from '../eval-within.js';
import type { BodyStatementsEvaluator } from '../body-statements-evaluator.js';
/**
 * Evaluates a for loop body for each iterator binding.
 *
 * The loop creates fresh local names for body-owned declarations while sharing
 * placement/ref maps with the parent context so generated references survive.
 */
export function evalForBodyControlFlow(
  stmt: ForStatement,
  ctx: EvalCtx,
  deferred: Deferred,
  evalBodyStatements: BodyStatementsEvaluator,
): void {
  const iterations = getIterations(stmt, ctx);
  const localNames = collectBodyLocalNames(stmt.body);
  const plan = stmt.within ? resolveForWithinPlan(stmt, ctx, iterations) : null;
  if (stmt.within && !plan) return;

  let ordinal = 0;
  for (const { bindings, whereBindings } of iterations) {
    const idx = ordinal++;
    if (!shouldEvalLoopBody(stmt, ctx, bindings, whereBindings)) continue;

    const iterCtx = loopIterationContext(ctx, localNames, bindings);
    applyWithinPlan(iterCtx, plan, idx);
    evalBodyStatements(stmt.body, iterCtx, deferred);
  }
}

/**
 * Resolves for within plan using the statements rules.
 */
function resolveForWithinPlan(
  stmt: ForStatement,
  ctx: EvalCtx,
  iterations: ReturnType<typeof getIterations>,
): WithinPlan | null {
  if (!stmt.within) return null;
  const occurrences = collectAutoOccurrences(stmt.body);
  const isGrid = stmt.iterator.kind === 'grid';
  const { cols, rows } = iteratorGridSize(stmt, ctx);
  /**
   * Handles measure fixed in the statements flow.
   */
  const measureFixed = (occ: AutoOccurrence): number =>
    measureFixedOccurrence(occ, ctx, iterations, { isGrid, cols, rows });

  return resolveWithinPlan(
    stmt,
    stmt.within,
    ctx,
    iterations.length,
    occurrences,
    measureFixed,
  );
}

/**
 * Handles measure fixed occurrence in the statements flow.
 */
function measureFixedOccurrence(
  occ: AutoOccurrence,
  ctx: EvalCtx,
  iterations: ReturnType<typeof getIterations>,
  grid: { isGrid: boolean; cols: number; rows: number },
): number {
  if (occ.fixed.length === 0) return 0;
  const idxs = occurrenceMeasureIndexes(occ, iterations.length, grid);
  let total = 0;
  for (const ix of idxs) {
    const it = iterations[ix];
    if (!it) continue;
    const m = childCtx(ctx);
    it.bindings.forEach((v, k) => m.values.set(k, v));
    for (const t of occ.fixed) {
      const signed = t.sign * evalNum(t.expr, m);
      if (signed > 0) total += signed;
    }
  }
  return total;
}

/**
 * Handles occurrence measure indexes in the statements flow.
 */
function occurrenceMeasureIndexes(
  occ: AutoOccurrence,
  iterationCount: number,
  grid: { isGrid: boolean; cols: number; rows: number },
): number[] {
  if (!grid.isGrid) return Array.from({ length: iterationCount }, (_, i) => i);
  if (occ.axis === 'y')
    return Array.from({ length: grid.rows }, (_, r) => r * grid.cols);
  return Array.from({ length: grid.cols }, (_, c) => c);
}

/**
 * Determines whether eval loop body is required.
 */
function shouldEvalLoopBody(
  stmt: ForStatement,
  ctx: EvalCtx,
  bindings: Map<string, EvalValue>,
  whereBindings: Map<string, EvalValue> | undefined,
): boolean {
  if (stmt.where === null) return true;
  const filterCtx = childCtx(ctx);
  (whereBindings ?? bindings).forEach((v, k) => filterCtx.values.set(k, v));
  return evalBool(stmt.where, filterCtx);
}

/**
 * Handles loop iteration context in the statements flow.
 */
function loopIterationContext(
  ctx: EvalCtx,
  localNames: string[],
  bindings: Map<string, EvalValue>,
): EvalCtx {
  const iterNames = new Map(ctx.names);
  for (const n of localNames) iterNames.set(n, fresh(ctx, n));

  const iterCtx: EvalCtx = {
    ...childCtx(ctx),
    names: iterNames,
    plantAnchors: ctx.plantAnchors,
    refBases: ctx.refBases,
  };
  bindings.forEach((v, k) => iterCtx.values.set(k, v));
  return iterCtx;
}

/**
 * Applies within plan to the supplied state or geometry.
 */
function applyWithinPlan(
  iterCtx: EvalCtx,
  plan: WithinPlan | null,
  idx: number,
): void {
  if (!plan) return;
  const col = idx % plan.cols;
  const row = Math.floor(idx / plan.cols);
  iterCtx.autoGroups = plan.nodeIndex;
  iterCtx.autoValues = plan.groups.map((grp) => {
    const k = plan.kind === 'range' ? idx : grp.axis === 'y' ? row : col;
    return (k + 1) * grp.gap;
  });
}
