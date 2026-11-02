/**
 * @author Aidan Boissonneault
 * @file eval-profile-object-ops.ts
 * @purpose Evaluates profile object ops for the geometry in evaluator package.
 * @last-edited October 6, 2026
 */

import type {
  IRLoft,
  IRRevolve,
  IRSweep,
  LoftOp,
  RevolveOp,
  SweepOp,
} from '@bushscad/ir';
import { toSpan } from '../core/eval-context.js';
import type { EvalCtx } from '../core/eval-types.js';
import { registerRevolveMetrics } from '../core/eval-metrics.js';
import { evalNum } from '../expressions/eval-expressions.js';
import { materialForObject } from '../metadata/eval-material-resolution.js';
import { paramSpansFrom } from '../statements/eval-param-spans.js';
import {
  evalPathInputName,
  evalSketchInputName,
} from './eval-inline-operands.js';
import { registerLoftMetrics } from './eval-loft-metrics.js';
import {
  requireClosedSketch,
  requireOpenGuideSketch,
} from './eval-primitives.js';
import { consumeSurfaceBoundSketch } from './eval-surface-bound-sketch.js';
import { evalSingularPlacement } from '../references/eval-repeatable-refs.js';
import { addError } from '../core/eval-context.js';

/** Emits a revolve operation and records revolve metrics for face references. */
export function evalRevolveOp(
  astName: string,
  irName: string,
  op: RevolveOp,
  ctx: EvalCtx,
): string {
  const sketchIrName = evalSketchInputName(op.sketch, ctx, astName);
  consumeSurfaceBoundSketch(ctx, sketchIrName, 'revolve', null, op.span);
  requireClosedSketch(ctx, sketchIrName, 'revolve', op.span);
  const radius = op.radius !== undefined ? evalNum(op.radius, ctx) : undefined;
  ctx.ops.push({
    kind: 'revolve',
    objName: irName,
    sketchName: sketchIrName,
    angleDeg: evalNum(op.angle, ctx),
    around:
      typeof op.around === 'string'
        ? op.around
        : evalSingularPlacement(op.around, ctx, op.around.span, 'revolve-axis'),
    radius,
    material: materialForObject(astName, ctx),
    paramSpans: paramSpansFrom({ angleDeg: op.angle }),
    span: toSpan(op.span),
  } satisfies IRRevolve);
  registerRevolveMetrics(ctx, irName, sketchIrName, radius, op.around);
  ctx.thisContext ??= ctx.faceMetrics.get(`${irName}.top`) ?? null;
  return irName;
}

/** Emits a sweep operation after validating that its profile is closed. */
export function evalSweepOp(
  astName: string,
  irName: string,
  op: SweepOp,
  ctx: EvalCtx,
): string {
  const sketchIrName = evalSketchInputName(op.sketch, ctx, astName);
  const pathIrName = evalPathInputName(op.path, ctx, astName);
  consumeSurfaceBoundSketch(ctx, sketchIrName, 'sweep', null, op.span);
  requireClosedSketch(ctx, sketchIrName, 'sweep', op.span);
  ctx.ops.push({
    kind: 'sweep',
    objName: irName,
    sketchName: sketchIrName,
    pathName: pathIrName,
    orientation: op.orientation,
    material: materialForObject(astName, ctx),
    span: toSpan(op.span),
  } satisfies IRSweep);
  return irName;
}

/** Emits a loft operation and validates guide/profile placement constraints. */
export function evalLoftOp(
  astName: string,
  irName: string,
  op: LoftOp,
  ctx: EvalCtx,
): string {
  const sketchNames = op.sketches.map((sketch, index) =>
    evalSketchInputName(sketch, ctx, `${astName}_${index}`),
  );
  validateLoftProfiles(sketchNames, op, ctx);
  const guide = op.guide
    ? evalSketchInputName(op.guide, ctx, `${astName}_guide`)
    : null;
  if (guide) requireOpenGuideSketch(ctx, guide, op.span);

  const height = evalNum(op.height, ctx);
  ctx.ops.push({
    kind: 'loft',
    objName: irName,
    sketchNames,
    height,
    guide,
    guideWorkplane: op.guideWorkplane,
    material: materialForObject(astName, ctx),
    span: toSpan(op.span),
  } satisfies IRLoft);
  registerLoftMetrics(ctx, irName, sketchNames, height);
  ctx.thisContext ??= ctx.faceMetrics.get(`${irName}.top`) ?? null;
  return irName;
}

/**
 * Validates loft profiles and reports any violations.
 */
function validateLoftProfiles(
  sketchNames: string[],
  op: LoftOp,
  ctx: EvalCtx,
): void {
  for (const sketchName of sketchNames) {
    consumeSurfaceBoundSketch(ctx, sketchName, 'loft', null, op.span);
    requireClosedSketch(ctx, sketchName, 'loft', op.span);
  }
  for (const secondary of sketchNames.slice(1)) {
    if (ctx.sketchExplicitPlacements.get(secondary)) {
      addError(
        ctx,
        `Secondary loft profile '${secondary}' must not have an explicit placement`,
        op.span,
      );
    }
  }
}
