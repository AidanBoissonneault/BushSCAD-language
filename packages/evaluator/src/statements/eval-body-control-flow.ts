/**
 * @author Aidan Boissonneault
 * @file eval-body-control-flow.ts
 * @purpose Evaluates body control flow for the statements in evaluator package.
 * @last-edited October 6, 2026
 */

import type {
  ComponentBody,
  ForStatement,
  IfStatement,
  IRMirror,
  IRMirrorPlane,
  IRRotate,
  IRRotationAxis,
  IRTransform,
  IRTransformOp,
  MirrorStmt,
  RotateStatement,
  TransformStmt,
} from '@bushscad/ir';
import { addError, childCtx, fresh, toSpan } from '../core/eval-context.js';
import type { Deferred, EvalCtx, EvalValue } from '../core/eval-types.js';
import {
  evalBool,
  evalNum,
  evalPlacement,
  serializeFaceRef,
} from '../expressions/eval-expressions.js';
import { getIterations } from '../expressions/eval-iterators.js';
import { objectTargetNames } from '../objects/eval-object-arrays.js';
import { collectBodyLocalNames } from './eval-body-local-names.js';
import {
  collectAutoOccurrences,
  iteratorGridSize,
  resolveWithinPlan,
  type AutoOccurrence,
  type WithinPlan,
} from './eval-within.js';

/**
 * Defines the `BodyStatementsEvaluator` callback contract used by the statements layer.
 */
export type BodyStatementsEvaluator = (
  body: ComponentBody,
  ctx: EvalCtx,
  deferred: Deferred,
) => void;

export { evalPatternLinear, evalPatternRadial } from './eval-patterns.js';

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

/**
 * Evaluates an if statement in a child context.
 */
export function evalIfBodyControlFlow(
  stmt: IfStatement,
  ctx: EvalCtx,
  deferred: Deferred,
  evalBodyStatements: BodyStatementsEvaluator,
): void {
  const branch = evalBool(stmt.condition, ctx) ? stmt.then : stmt.else;
  if (branch === null) return;
  const branchCtx = childCtx(ctx);
  branchCtx.activeColor = ctx.activeColor;
  branchCtx.activeMaterial = ctx.activeMaterial;
  evalBodyStatements(branch, branchCtx, deferred);
}

/**
 * Emits rotate operations for placed objects or object targets.
 */
export function evalRotate(stmt: RotateStatement, ctx: EvalCtx): void {
  const placedTarget = ctx.placedInstanceRoots.get(stmt.target);
  if (
    !placedTarget &&
    (ctx.components.has(stmt.target) || ctx.functions.has(stmt.target))
  ) {
    addError(
      ctx,
      `No placed instance of '${stmt.target}' is available for rotate`,
      stmt.span,
    );
    return;
  }
  const around =
    typeof stmt.around === 'string'
      ? stmt.around
      : evalPlacement(stmt.around, ctx);
  for (const target of placedTarget
    ? [placedTarget]
    : objectTargetNames(stmt.target, ctx)) {
    ctx.ops.push({
      kind: 'rotate',
      target,
      angleDeg: evalNum(stmt.angle, ctx),
      around,
      span: toSpan(stmt.span),
    } satisfies IRRotate);
  }
}

/**
 * Emits mirror operations after resolving the mirror plane.
 */
export function evalMirror(stmt: MirrorStmt, ctx: EvalCtx): void {
  const across = evalMirrorPlane(stmt.across, ctx);
  for (const objName of objectTargetNames(stmt.target, ctx)) {
    ctx.ops.push({
      kind: 'mirror',
      objName,
      across,
      span: toSpan(stmt.span),
    } satisfies IRMirror);
  }
}

/**
 * Converts a mirror statement plane into the IR mirror plane shape.
 */
function evalMirrorPlane(
  plane: MirrorStmt['across'],
  ctx: EvalCtx,
): IRMirrorPlane {
  if (plane.kind === 'world') {
    return { kind: 'world', axis: plane.axis.toLowerCase() as 'x' | 'y' | 'z' };
  }
  if (plane.kind === 'named') {
    return { kind: 'named', name: plane.name };
  }
  return { kind: 'faceRef', ref: serializeFaceRef(plane.ref, ctx) };
}

/**
 * Emits transform operations for resolved object targets.
 */
export function evalTransform(stmt: TransformStmt, ctx: EvalCtx): void {
  const operation = evalTransformOp(stmt.operation, ctx);
  for (const objName of objectTargetNames(stmt.target, ctx)) {
    ctx.ops.push({
      kind: 'transform',
      objName,
      operation,
      span: toSpan(stmt.span),
    } satisfies IRTransform);
  }
}

/**
 * Converts a parsed transform operation into the evaluator IR operation.
 */
function evalTransformOp(
  op: TransformStmt['operation'],
  ctx: EvalCtx,
): IRTransformOp {
  if (op.kind === 'translate') {
    return {
      kind: 'translate',
      x: op.x ? evalNum(op.x, ctx) * ctx.baseUnitMm : 0,
      y: op.y ? evalNum(op.y, ctx) * ctx.baseUnitMm : 0,
      z: op.z ? evalNum(op.z, ctx) * ctx.baseUnitMm : 0,
    };
  }
  if (op.kind === 'rotate') {
    const around: IRRotationAxis =
      typeof op.around === 'string' ? op.around : evalPlacement(op.around, ctx);
    return {
      kind: 'rotate',
      angleDeg: evalNum(op.angle, ctx),
      around,
    };
  }
  return {
    kind: 'scale',
    factor: evalNum(op.factor, ctx),
  };
}
