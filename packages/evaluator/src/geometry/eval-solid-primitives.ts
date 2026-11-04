/**
 * @author Aidan Boissonneault
 * @file eval-solid-primitives.ts
 * @purpose Evaluates solid primitives for the geometry in evaluator package.
 * @last-edited October 6, 2026
 */

import type { IRSolidPrimitive, SolidPrimitiveOp } from '@bushscad/ir';
import type { EvalCtx } from '../core/eval-types.js';
import { toSpan } from '../core/eval-context.js';
import { evalRepeatablePlacements } from '../references/eval-repeatable-refs.js';
import { materialForObject } from '../metadata/eval-material-resolution.js';
import { registerSolidPrimitiveMetrics } from './eval-solid-primitive-metrics.js';
import { normalizeSolidPrimitive } from './solid-primitives/normalize-solid-primitive.js';

/**
 * Lowers a direct source primitive into a concrete IR primitive operation.
 * Source-compatible primitive calls accept aliases from OpenSCAD and JSCAD.
 * Normalizing them here keeps the OCCT bridge focused on geometry, not syntax.
 */
export function evalSolidPrimitiveOp(
  astName: string,
  irName: string,
  op: SolidPrimitiveOp,
  ctx: EvalCtx,
): string {
  const placement = op.placement
    ? evalRepeatablePlacements(op.placement, ctx)[0]
    : null;
  const shape = normalizeSolidPrimitive(op, ctx);
  ctx.ops.push({
    kind: 'solidPrimitive',
    objName: irName,
    shape,
    placement,
    material: materialForObject(astName, ctx),
    span: toSpan(op.span),
  } satisfies IRSolidPrimitive);
  registerSolidPrimitiveMetrics(ctx, irName, shape);
  ctx.thisContext ??= ctx.faceMetrics.get(`${irName}.top`) ?? null;
  return irName;
}
