/**
 * Evaluates a for-loop body for each iterator binding.
 */
import type {
  ComponentBody,
  ForStatement,
  IROp,
  SourceSpan,
} from '@bushscad/ir';
import {
  captureScalarCacheContext,
  childCtx,
  fresh,
} from '../../core/eval-context.js';
import type { Deferred, EvalCtx, EvalValue } from '../../core/eval-types.js';
import { evalBool, evalNum } from '../../expressions/eval-expressions.js';
import {
  forEachIteration,
  getIterations,
} from '../../expressions/eval-iterators.js';
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
  if (!stmt.within) {
    const localNames = collectBodyLocalNames(stmt.body, ctx.bodyNameFacts);
    forEachIteration(stmt, ctx, ({ bindings, whereBindings }) => {
      if (!shouldEvalLoopBody(stmt, ctx, bindings, whereBindings)) return;
      const iterCtx = loopIterationContext(ctx, localNames, bindings);
      evaluateLoopIterationBody(
        stmt.body,
        ctx,
        iterCtx,
        deferred,
        evalBodyStatements,
      );
    });
    return;
  }

  const iterations = getIterations(stmt, ctx);
  const localNames = collectBodyLocalNames(stmt.body, ctx.bodyNameFacts);
  const plan = resolveForWithinPlan(stmt, ctx, iterations);
  if (!plan) return;

  for (const [idx, { bindings, whereBindings }] of iterations.entries()) {
    if (!shouldEvalLoopBody(stmt, ctx, bindings, whereBindings)) continue;
    const iterCtx = loopIterationContext(ctx, localNames, bindings);
    applyWithinPlan(iterCtx, plan, idx);
    evaluateLoopIterationBody(
      stmt.body,
      ctx,
      iterCtx,
      deferred,
      evalBodyStatements,
    );
  }
}

/** Evaluates one iteration and preserves its conditional breakpoint bindings. */
function evaluateLoopIterationBody(
  body: ComponentBody,
  parentCtx: EvalCtx,
  iterCtx: EvalCtx,
  deferred: Deferred,
  evalBodyStatements: BodyStatementsEvaluator,
): void {
  const opStart = parentCtx.ops.length;
  const deferredStart = deferred.length;
  evalBodyStatements(body, iterCtx, deferred);
  annotateCacheContext(parentCtx.ops, opStart, iterCtx);
  annotateCacheContext(deferred, deferredStart, iterCtx);
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
  localNames: readonly string[],
  bindings: Map<string, EvalValue>,
): EvalCtx {
  const iterCtx: EvalCtx = {
    ...childCtx(ctx),
    plantAnchors: ctx.plantAnchors,
    refBases: ctx.refBases,
  };
  for (const name of localNames) iterCtx.names.set(name, fresh(ctx, name));
  bindings.forEach((v, k) => iterCtx.values.set(k, v));
  return iterCtx;
}

/** Adds loop bindings only to operations explicitly named by a conditional breakpoint. */
function annotateCacheContext(
  operations: IROp[],
  startIndex: number,
  iterCtx: EvalCtx,
): void {
  if (iterCtx.cacheContextSpans.size === 0) return;
  for (let index = startIndex; index < operations.length; index++) {
    const operation = operations[index];
    if (
      !operation ||
      operation.cacheContext ||
      !hasConditionalBreakpoint(iterCtx, operation.span)
    )
      continue;
    const cacheContext = captureScalarCacheContext(iterCtx.values);
    if (Object.keys(cacheContext).length === 0) continue;
    operations[index] = {
      ...operation,
      cacheContext,
    };
  }
}

/** Checks whether an operation source span needs loop values for a breakpoint condition. */
function hasConditionalBreakpoint(ctx: EvalCtx, span: SourceSpan): boolean {
  return ctx.cacheContextSpans.has(`${span.file}\0${span.line}`);
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
