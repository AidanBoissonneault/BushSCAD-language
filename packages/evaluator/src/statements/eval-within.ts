/**
 * @author Aidan Boissonneault
 * @file eval-within.ts
 * @purpose Evaluates within for the statements in evaluator package.
 * @last-edited October 6, 2026
 */

import type {
  AutoExpr,
  ForStatement,
  WithinClause,
  WithinDim,
} from '@bushscad/ir';
import type { EvalCtx } from '../core/eval-types.js';
import { addError } from '../core/eval-context.js';
import { evalNum, serializeFaceRef } from '../expressions/eval-expressions.js';
import type { Axis } from '../core/eval-auto-types.js';
import type { AutoOccurrence } from './eval-within-auto-occurrences.js';
export { collectAutoOccurrences } from './eval-within-auto-occurrences.js';
export type { AutoOccurrence } from './eval-within-auto-occurrences.js';

/**
 * Resolved `within` distribution. `groups[g].gap` is the equal-gap step
 * (including edge margins) for occurrence `g`; `nodeIndex` maps each `auto`
 * AST node to its group.
 */
export interface WithinPlan {
  kind: 'range' | 'grid';
  cols: number;
  groups: { axis: Axis; gap: number }[];
  nodeIndex: Map<AutoExpr, number>;
}

/**
 * Evaluates a loop iterator's grid dimensions, using 1x1 for range iterators.
 * The same dimensions drive both fixed-term measurement and within-plan
 * spacing, so they must stay consistent.
 */
export function iteratorGridSize(
  stmt: ForStatement,
  ctx: EvalCtx,
): { cols: number; rows: number } {
  if (stmt.iterator.kind !== 'grid') return { cols: 1, rows: 1 };
  return {
    cols: Math.round(evalNum(stmt.iterator.cols, ctx)),
    rows: Math.round(evalNum(stmt.iterator.rows, ctx)),
  };
}

/**
 * Resolves dim using the statements rules.
 */
function resolveDim(dim: WithinDim, ctx: EvalCtx): number | null {
  if (dim.kind === 'expr') return evalNum(dim.expr, ctx);
  const key = serializeFaceRef(dim.ref, ctx);
  const metrics = ctx.faceMetrics.get(key);
  if (!metrics) {
    addError(
      ctx,
      `'within' dimension '${key}.${dim.dim}' refers to an unknown or not-yet-built face`,
      dim.span,
    );
    return null;
  }
  return dim.dim === 'width' ? metrics.width : metrics.height;
}

/**
 * Resolves a loop's `within` clause into a per-occurrence distribution plan.
 * `measureFixed(occ)` must return the summed inline fixed terms (`F`) for an
 * occurrence across the iterations along its axis.
 *
 * Returns `null` after emitting an error when any spacing is non-positive.
 */
export function resolveWithinPlan(
  stmt: ForStatement,
  within: WithinClause,
  ctx: EvalCtx,
  nominalCount: number,
  occurrences: AutoOccurrence[],
  measureFixed: (occ: AutoOccurrence) => number,
): WithinPlan | null {
  const isGrid = stmt.iterator.kind === 'grid';
  const nodeIndex = new Map<AutoExpr, number>();
  occurrences.forEach((occ, i) => nodeIndex.set(occ.node, i));

  const spanX = resolveDim(within.dims[0], ctx);
  if (spanX === null) return null;
  const spanY =
    isGrid && within.dims[1] ? resolveDim(within.dims[1], ctx) : null;
  if (isGrid && spanY === null) return null;

  const { cols, rows } = iteratorGridSize(stmt, ctx);

  const groups: { axis: Axis; gap: number }[] = [];
  for (const occ of occurrences) {
    let span: number;
    let count: number;
    if (!isGrid) {
      span = spanX;
      count = nominalCount;
    } else if (occ.axis === 'x') {
      span = spanX;
      count = cols;
    } else if (occ.axis === 'y') {
      span = spanY as number;
      count = rows;
    } else {
      addError(
        ctx,
        `'auto' in a grid 'within' loop must sit in an x: or y: position`,
        within.span,
      );
      return null;
    }
    const fixed = measureFixed(occ);
    const gap = (span - fixed) / (count + 1);
    if (gap <= 0) {
      addError(
        ctx,
        `'within' distribution is non-positive: span ${span} over ${count} item(s) leaves no room`,
        within.span,
      );
      return null;
    }
    groups.push({ axis: occ.axis, gap });
  }

  return { kind: isGrid ? 'grid' : 'range', cols, groups, nodeIndex };
}
