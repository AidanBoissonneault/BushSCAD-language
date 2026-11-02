/**
 * @author Aidan Boissonneault
 * @file eval-patterns.ts
 * @purpose Evaluates patterns for the statements in evaluator package.
 * @last-edited October 6, 2026
 */

import type {
  IRPatternLinear,
  IRPatternRadial,
  PatternLinearStmt,
  PatternRadialStmt,
} from '@bushscad/ir';
import { toSpan } from '../core/eval-context.js';
import type { EvalCtx, HoleStep } from '../core/eval-types.js';
import { evalNum, serializeFaceRef } from '../expressions/eval-expressions.js';
import {
  emitHoleSketchAndCut,
  offsetIRPlacement,
} from '../geometry/eval-op-emission.js';
import { objectTargetNames } from '../objects/eval-object-arrays.js';

/**
 * Measurements for linear pattern, including count x, count y, spacing x, and spacing y.
 */
type LinearPatternMetrics = {
  countX: number;
  countY: number;
  spacingX: number;
  spacingY: number;
};

/**
 * Emits linear pattern operations or replays recorded hole steps.
 *
 * Hole recipes are expanded in the evaluator because each copied hole needs
 * matching sketch and cut operation names before bridge execution.
 */
export function evalPatternLinear(stmt: PatternLinearStmt, ctx: EvalCtx): void {
  const metrics = linearPatternMetrics(stmt, ctx);
  const span = toSpan(stmt.span);

  for (const objName of objectTargetNames(stmt.target, ctx)) {
    const holeRecipe = ctx.holeRecipes.get(objName);
    if (holeRecipe) {
      emitLinearHolePattern(ctx, objName, holeRecipe, metrics);
      continue;
    }

    ctx.ops.push({
      kind: 'patternLinear',
      objName,
      ...metrics,
      span,
    } satisfies IRPatternLinear);
  }
}

/**
 * Handles linear pattern metrics in the statements flow.
 */
function linearPatternMetrics(
  stmt: PatternLinearStmt,
  ctx: EvalCtx,
): LinearPatternMetrics {
  return {
    countX: Math.round(evalNum(stmt.countX, ctx)),
    countY: stmt.countY ? Math.round(evalNum(stmt.countY, ctx)) : 1,
    spacingX: evalNum(stmt.spacingX, ctx) * ctx.baseUnitMm,
    spacingY: stmt.spacingY ? evalNum(stmt.spacingY, ctx) * ctx.baseUnitMm : 0,
  };
}

/**
 * Emits linear hole pattern into the current output.
 */
function emitLinearHolePattern(
  ctx: EvalCtx,
  objName: string,
  holeRecipe: HoleStep[],
  { countX, countY, spacingX, spacingY }: LinearPatternMetrics,
): void {
  for (let i = 0; i < countX; i++) {
    for (let j = 0; j < countY; j++) {
      if (i === 0 && j === 0) continue;
      emitHolePatternCopy(ctx, objName, holeRecipe, {
        i,
        j,
        dx: i * spacingX,
        dy: j * spacingY,
      });
    }
  }
}

/**
 * Emits hole pattern copy into the current output.
 */
function emitHolePatternCopy(
  ctx: EvalCtx,
  objName: string,
  holeRecipe: HoleStep[],
  copy: { i: number; j: number; dx: number; dy: number },
): void {
  const copyBase = `${objName}__p${copy.i}_${copy.j}`;
  for (const step of holeRecipe) {
    const skName = copyBase + step.sketchIrName.slice(objName.length);
    const cutName =
      step.objIrName === objName
        ? copyBase
        : copyBase + step.objIrName.slice(objName.length);
    const placement = offsetIRPlacement(step.placement, copy.dx, copy.dy);
    emitHoleSketchAndCut(
      ctx,
      skName,
      cutName,
      step.diameterMm,
      step.through,
      step.throughTarget,
      step.depthMm,
      placement,
      step.span,
    );
  }
}

/**
 * Emits radial pattern operations after resolving target names and references.
 */
export function evalPatternRadial(stmt: PatternRadialStmt, ctx: EvalCtx): void {
  for (const objName of objectTargetNames(stmt.target, ctx)) {
    ctx.ops.push({
      kind: 'patternRadial',
      objName,
      count: Math.round(evalNum(stmt.count, ctx)),
      aroundRef: serializeFaceRef(stmt.around, ctx),
      span: toSpan(stmt.span),
    } satisfies IRPatternRadial);
  }
}
