/**
 * @author Aidan Boissonneault
 * @file eval-sketch-op-emission.ts
 * @purpose Evaluates sketch op emission for the geometry in evaluator package.
 * @last-edited October 6, 2026
 */

import type {
  ComponentStatement,
  IRSketch,
  TopLevelStatement,
} from '@bushscad/ir';
import { metricsForPlacement, toSpan } from '../core/eval-context.js';
import type { EvalCtx } from '../core/eval-types.js';
import { evalPrimitive } from '../sketch/primitives/evaluate-primitive.js';
import {
  evalSketchPlacementInfo,
  rememberSurfaceBoundSketch,
} from './eval-surface-bound-sketch.js';
import { evaluatedSketchComponentMembers } from '../sketch/eval-sketch-component-members.js';

/**
 * Emits a sketch operation and stores the primitive/placement metadata used downstream.
 * Object operations and UI previews all consume the same sketch maps, so
 * sketch emission is centralized before geometry lowering.
 */
export function emitSketchOp(
  stmt: Extract<ComponentStatement | TopLevelStatement, { kind: 'sketch' }>,
  ctx: EvalCtx,
  irName: string,
): void {
  const { placement, surfaceBound } = evalSketchPlacementInfo(stmt, ctx);
  const prevThisContext = ctx.thisContext;
  if (surfaceBound) {
    ctx.thisContext = metricsForPlacement(ctx, surfaceBound) ?? ctx.thisContext;
  }
  const prim = evalPrimitive(stmt.primitive, ctx);
  ctx.thisContext = prevThisContext;
  if (prim === null) return;
  ctx.sketches.set(irName, prim);
  for (const member of evaluatedSketchComponentMembers(prim)) {
    ctx.sketchComponentMembers.add(member);
  }
  ctx.sketchPlacements.set(irName, placement);
  ctx.sketchExplicitPlacements.set(irName, stmt.placement !== undefined);
  rememberSurfaceBoundSketch(ctx, irName, surfaceBound);
  ctx.ops.push({
    kind: 'sketch',
    name: irName,
    primitive: prim,
    placement,
    surfaceBound,
    span: toSpan(stmt.span),
  } satisfies IRSketch);
}
