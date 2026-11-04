/**
 * @author Aidan Boissonneault
 * @file eval-linear-object-ops.ts
 * @purpose Evaluates linear object ops for the geometry in evaluator package.
 * @last-edited October 6, 2026
 */

import type {
  CutOp,
  ExtrudeOp,
  IRCut,
  IRExtrude,
  IRSweepCut,
  SweepCutOp,
} from '@bushscad/ir';
import { addError, toSpan } from '../core/eval-context.js';
import type { EvalCtx } from '../core/eval-types.js';
import { registerObjectMetricsWithDepth } from '../core/eval-metrics.js';
import { evalNum } from '../expressions/eval-expressions.js';
import { materialForObject } from '../metadata/eval-material-resolution.js';
import { paramSpansFrom } from '../statements/eval-param-spans.js';
import { evalPathInputName } from './eval-inline-operands.js';
import {
  evalPlacedSketchInput,
  posOffsets,
} from './eval-object-op-placement.js';
import { requireClosedSketch } from '../sketch/eval-profile-validation.js';
import { evalThroughTargetName } from './eval-through-target.js';
import { consumeSurfaceBoundSketch } from './eval-surface-bound-sketch.js';
import { evalSketchBodySelection } from '../sketch/eval-sketch-body-selection.js';

/** Emits an extrude operation and records the derived object metrics. */
export function evalExtrudeOp(
  astName: string,
  irName: string,
  op: ExtrudeOp,
  ctx: EvalCtx,
): string {
  const depth = evalNum(op.depth, ctx);
  const { explicitFrom, sketchIrName } = evalPlacedSketchInput(
    op.sketch,
    op.from,
    astName,
    null,
    ctx,
  );
  const from = consumeSurfaceBoundSketch(
    ctx,
    sketchIrName,
    'extrude',
    explicitFrom,
    op.span,
  );
  const closedBodyNames = evalSketchBodySelection(
    op.sketch,
    sketchIrName,
    op.span,
    ctx,
  );
  requireClosedSketch(ctx, sketchIrName, 'extrude', op.span);
  ctx.ops.push({
    kind: 'extrude',
    objName: irName,
    sketchName: sketchIrName,
    closedBodyNames,
    depth,
    from,
    symmetric: op.symmetric,
    wrap: op.wrap,
    material: materialForObject(astName, ctx),
    paramSpans: paramSpansFrom({ depth: op.depth, ...posOffsets(op.from) }),
    span: toSpan(op.span),
  } satisfies IRExtrude);
  registerObjectMetricsWithDepth(ctx, irName, sketchIrName, depth);
  ctx.thisContext ??= ctx.faceMetrics.get(`${irName}.top`) ?? null;
  return irName;
}

/** Emits a sketch-based cut after resolving or inferring its placement. */
export function evalCutOp(
  astName: string,
  irName: string,
  op: CutOp,
  ctx: EvalCtx,
): string {
  const { explicitFrom, sketchIrName } = evalPlacedSketchInput(
    op.sketch,
    op.from,
    astName,
    ctx.activePlacement,
    ctx,
  );
  const depth = op.depth !== null ? evalNum(op.depth, ctx) : null;
  const from = consumeSurfaceBoundSketch(
    ctx,
    sketchIrName,
    'cut',
    explicitFrom,
    op.span,
  );
  const closedBodyNames = evalSketchBodySelection(
    op.sketch,
    sketchIrName,
    op.span,
    ctx,
  );
  requireClosedSketch(ctx, sketchIrName, 'cut', op.span);
  if (!from) {
    addError(
      ctx,
      `cut(...) without a spatial argument requires a placement context; add a final @target argument or call the function with place(...)`,
      op.span,
    );
    return irName;
  }
  ctx.ops.push({
    kind: 'cut',
    objName: irName,
    sketchName: sketchIrName,
    closedBodyNames,
    through: op.through !== null,
    throughTarget: evalThroughTargetName(op.through, from, ctx),
    depth,
    from,
    wrap: op.wrap,
    paramSpans: paramSpansFrom({ depth: op.depth, ...posOffsets(op.from) }),
    span: toSpan(op.span),
  } satisfies IRCut);
  ctx.cutThreads.set(irName, { placement: from, depthMm: depth });
  registerObjectMetricsWithDepth(ctx, irName, sketchIrName, depth ?? 0);
  ctx.thisContext ??= ctx.faceMetrics.get(`${irName}.top`) ?? null;
  return irName;
}

/** Emits a sweep cut, preserving placement validation and through-target lowering. */
export function evalSweepCutOp(
  astName: string,
  irName: string,
  op: SweepCutOp,
  ctx: EvalCtx,
): string {
  const { explicitFrom, sketchIrName } = evalPlacedSketchInput(
    op.sketch,
    op.from,
    astName,
    ctx.activePlacement,
    ctx,
  );
  const pathIrName = evalPathInputName(op.path, ctx, astName);
  requireClosedSketch(ctx, sketchIrName, 'sweep cut', op.span);
  const from = consumeSurfaceBoundSketch(
    ctx,
    sketchIrName,
    'sweep_cut',
    explicitFrom,
    op.span,
  );
  if (!from) {
    addError(
      ctx,
      `sweep_cut without 'from' requires a placement context`,
      op.span,
    );
    return irName;
  }
  ctx.ops.push({
    kind: 'sweep_cut',
    objName: irName,
    sketchName: sketchIrName,
    pathName: pathIrName,
    through: op.through !== null,
    throughTarget: evalThroughTargetName(op.through, from, ctx),
    depth: op.depth !== null ? evalNum(op.depth, ctx) : null,
    from,
    orientation: op.orientation,
    span: toSpan(op.span),
  } satisfies IRSweepCut);
  return irName;
}
