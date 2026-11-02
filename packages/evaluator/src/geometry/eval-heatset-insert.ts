/**
 * @author Aidan Boissonneault
 * @file eval-heatset-insert.ts
 * @purpose Evaluates heatset insert for the geometry in evaluator package.
 * @last-edited October 6, 2026
 */

import type { HeatsetInsertOp } from '@bushscad/ir';
import { METRIC_HARDWARE, normalizeSize } from '@bushscad/std-hardware';
import { addError, toSpan } from '../core/eval-context.js';
import type { EvalCtx } from '../core/eval-types.js';
import { evalNum } from '../expressions/eval-expressions.js';
import { emitInsertVisual } from './eval-hardware-visuals.js';
import {
  emitHoleSketchAndCut,
  holeStep,
  resolveHardwarePlacement,
} from './eval-hardware-hole.js';

/** Lowers heatset_insert() shorthand into the same generated hole recipe shape. */
export function evalHeatsetInsertOp(
  astName: string,
  op: HeatsetInsertOp,
  ctx: EvalCtx,
): string {
  const irName = ctx.names.get(astName) ?? astName;
  const entry = METRIC_HARDWARE[normalizeSize(op.size)];
  if (!entry) {
    addError(
      ctx,
      `Unknown hardware size '${op.size}' â€” use M2, M2.5, M3, M4, M5, M6, or M8`,
      op.span,
    );
    return irName;
  }

  const from = resolveHardwarePlacement(
    op,
    ctx,
    `heatset_insert(...) without 'from' requires a placement context`,
  );
  if (!from) {
    return irName;
  }

  const spec = entry.heatset_insert;
  const depthMm =
    op.depth !== null
      ? evalNum(op.depth, ctx) * ctx.baseUnitMm
      : spec.defaultDepth;
  const span = toSpan(op.span);
  const skName = `${irName}__sk`;
  emitHoleSketchAndCut(
    ctx,
    skName,
    irName,
    spec.outerDiameter,
    false,
    null,
    depthMm,
    from,
    span,
  );
  ctx.holeRecipes.set(irName, [
    holeStep(
      skName,
      irName,
      spec.outerDiameter,
      false,
      null,
      depthMm,
      from,
      span,
    ),
  ]);
  emitInsertVisual(ctx, irName, spec.outerDiameter, depthMm, from, span);
  return irName;
}
