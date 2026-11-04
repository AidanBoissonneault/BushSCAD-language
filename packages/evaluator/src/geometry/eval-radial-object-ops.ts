/**
 * @author Aidan Boissonneault
 * @file eval-radial-object-ops.ts
 * @purpose Evaluates radial object ops for the geometry in evaluator package.
 * @last-edited October 6, 2026
 */

import type {
  IRRadialCurve,
  IRRadialCut,
  IRRadialDirection,
  IRRadialExtent,
  IRRadialExtrude,
  RadialCurve,
  RadialCutOp,
  RadialExtrudeOp,
} from '@bushscad/ir';
import { addError, toSpan } from '../core/eval-context.js';
import type { EvalCtx } from '../core/eval-types.js';
import { registerRevolveMetrics } from '../core/eval-metrics.js';
import { evalNum } from '../expressions/eval-expressions.js';
import { materialForObject } from '../metadata/eval-material-resolution.js';
import {
  evalRepeatablePlacements,
  evalSingularPlacement,
} from '../references/eval-repeatable-refs.js';
import { paramSpansFrom } from '../statements/eval-param-spans.js';
import { evalSketchInputName } from './eval-inline-operands.js';
import { requireClosedSketch } from '../sketch/eval-profile-validation.js';
import { consumeSurfaceBoundSketch } from './eval-surface-bound-sketch.js';

/**
 * Emits radial extrude or radial cut IR after resolving its axis and extent.
 *
 * Radial operations share most lowering rules but differ in material emission
 * and the required placement context for cuts.
 */
export function evalRadialOp(
  astName: string,
  irName: string,
  op: RadialExtrudeOp | RadialCutOp,
  ctx: EvalCtx,
): string {
  const sketchIrName = evalSketchInputName(op.sketch, ctx, astName);
  consumeSurfaceBoundSketch(ctx, sketchIrName, op.kind, null, op.span);
  requireClosedSketch(
    ctx,
    sketchIrName,
    op.kind === 'radial_extrude' ? 'radial_extrude' : 'radial_cut',
    op.span,
  );

  const values = radialValues(op, ctx);
  if (!values.around) {
    addError(
      ctx,
      `radial operation requires 'axis:' or an inferable 'from:' placement`,
      op.span,
    );
    return irName;
  }

  if (values.taperDeg <= -89 || values.taperDeg >= 89) {
    addError(ctx, `radial taper must be in (-89, 89) degrees`, op.span);
  }

  if (op.kind === 'radial_extrude') {
    return emitRadialExtrude(astName, irName, sketchIrName, op, values, ctx);
  }
  return emitRadialCut(irName, sketchIrName, op, values, ctx);
}

/**
 * Handles radial values in the geometry flow.
 */
function radialValues(op: RadialExtrudeOp | RadialCutOp, ctx: EvalCtx) {
  const extent = evalRadialExtent(op, ctx);
  const from = radialFrom(op, ctx);
  return {
    extent,
    curve: evalRadialCurve(op.curve, ctx),
    startDeg: op.start ? evalNum(op.start, ctx) : 0,
    twistDeg: op.twist ? evalNum(op.twist, ctx) : 0,
    taperDeg: op.taper ? evalNum(op.taper, ctx) : 0,
    radius: op.radius ? evalNum(op.radius, ctx) : 0,
    sections: radialSections(op, ctx),
    from,
    around: radialAround(op, ctx, extent, from),
    direction: op.direction as IRRadialDirection,
    paramSpans: radialParamSpans(op),
  };
}

/**
 * Handles radial from in the geometry flow.
 */
function radialFrom(op: RadialExtrudeOp | RadialCutOp, ctx: EvalCtx) {
  return op.from
    ? evalRepeatablePlacements(op.from, ctx)[0]
    : ctx.activePlacement;
}

/**
 * Handles radial sections in the geometry flow.
 */
function radialSections(op: RadialExtrudeOp | RadialCutOp, ctx: EvalCtx) {
  return op.sections.kind === 'expr'
    ? Math.max(1, Math.round(evalNum(op.sections.value, ctx)))
    : null;
}

/**
 * Handles radial around in the geometry flow.
 */
function radialAround(
  op: RadialExtrudeOp | RadialCutOp,
  ctx: EvalCtx,
  extent: IRRadialExtent,
  from: ReturnType<typeof radialFrom>,
) {
  if (!op.axis) {
    return from ?? (extent.kind === 'placement-bridge' ? extent.from : null);
  }
  return typeof op.axis === 'string'
    ? op.axis
    : evalSingularPlacement(op.axis, ctx, op.axis.span, 'revolve-axis');
}

/**
 * Handles radial param spans in the geometry flow.
 */
function radialParamSpans(op: RadialExtrudeOp | RadialCutOp) {
  return paramSpansFrom({
    angleDeg: op.extent.kind === 'angle-length' ? op.extent.angle : undefined,
    lengthMm: op.extent.kind === 'angle-length' ? op.extent.length : undefined,
    startDeg: op.start ?? undefined,
    twistDeg: op.twist ?? undefined,
    taperDeg: op.taper ?? undefined,
    radius: op.radius ?? undefined,
  });
}

/**
 * Emits radial extrude into the current output.
 */
function emitRadialExtrude(
  astName: string,
  irName: string,
  sketchIrName: string,
  op: RadialExtrudeOp,
  values: ReturnType<typeof radialValues>,
  ctx: EvalCtx,
): string {
  ctx.ops.push({
    kind: 'radial_extrude',
    objName: irName,
    sketchName: sketchIrName,
    axis: values.around!,
    extent: values.extent,
    curve: values.curve,
    direction: values.direction,
    startDeg: values.startDeg,
    twistDeg: values.twistDeg,
    taperDeg: values.taperDeg,
    radius: values.radius,
    sections: values.sections,
    from: values.from,
    material: materialForObject(astName, ctx),
    paramSpans: values.paramSpans,
    span: toSpan(op.span),
  } satisfies IRRadialExtrude);
  registerRevolveMetrics(
    ctx,
    irName,
    sketchIrName,
    values.radius,
    typeof op.axis === 'string' ? op.axis : undefined,
  );
  ctx.thisContext ??= ctx.faceMetrics.get(`${irName}.top`) ?? null;
  return irName;
}

/**
 * Emits radial cut into the current output.
 */
function emitRadialCut(
  irName: string,
  sketchIrName: string,
  op: RadialCutOp,
  values: ReturnType<typeof radialValues>,
  ctx: EvalCtx,
): string {
  if (!values.from) {
    addError(
      ctx,
      `radial_cut without 'from:' requires a placement context; add from: ... or call inside place(...)`,
      op.span,
    );
    return irName;
  }
  ctx.ops.push({
    kind: 'radial_cut',
    objName: irName,
    sketchName: sketchIrName,
    axis: values.around!,
    extent: values.extent,
    curve: values.curve,
    direction: values.direction,
    startDeg: values.startDeg,
    twistDeg: values.twistDeg,
    taperDeg: values.taperDeg,
    radius: values.radius,
    sections: values.sections,
    from: values.from,
    paramSpans: values.paramSpans,
    span: toSpan(op.span),
  } satisfies IRRadialCut);
  return irName;
}

/**
 * Evaluates radial curve with the current evaluation context.
 */
function evalRadialCurve(curve: RadialCurve, ctx: EvalCtx): IRRadialCurve {
  if (curve.kind === 'cubic-bezier') {
    const x1 = evalNum(curve.x1, ctx);
    const y1 = evalNum(curve.y1, ctx);
    const x2 = evalNum(curve.x2, ctx);
    const y2 = evalNum(curve.y2, ctx);
    if (x1 < 0 || x1 > 1 || x2 < 0 || x2 > 1) {
      addError(ctx, `cubic-bezier requires x1 and x2 in [0,1]`, curve.span);
    }
    return { kind: 'cubic-bezier', x1, y1, x2, y2 };
  }
  return { kind: curve.kind };
}

/**
 * Evaluates radial extent with the current evaluation context.
 */
function evalRadialExtent(
  op: RadialExtrudeOp | RadialCutOp,
  ctx: EvalCtx,
): IRRadialExtent {
  if (op.extent.kind === 'angle-length') {
    return {
      kind: 'angle-length',
      angleDeg: evalNum(op.extent.angle, ctx),
      lengthMm: evalNum(op.extent.length, ctx),
    };
  }
  if (op.extent.kind === 'placement-bridge') {
    return {
      kind: 'placement-bridge',
      from: evalRepeatablePlacements(op.extent.from, ctx)[0],
      to: evalRepeatablePlacements(op.extent.to, ctx)[0],
      guidePathName: op.extent.along
        ? (ctx.names.get(op.extent.along) ?? op.extent.along)
        : null,
    };
  }
  const aPlacement = evalRepeatablePlacements(op.extent.a, ctx)[0];
  const bPlacement = evalRepeatablePlacements(op.extent.b, ctx)[0];
  return { kind: 'between', a: aPlacement.faceRef, b: bPlacement.faceRef };
}
