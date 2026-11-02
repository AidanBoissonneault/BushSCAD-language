/**
 * @author Aidan Boissonneault
 * @file eval-surface.ts
 * @purpose Evaluates surface for the geometry in evaluator package.
 * @last-edited October 6, 2026
 */

import type {
  IRSurfaceFill,
  IRSurfaceOffset,
  IRSurfaceThicken,
  SurfaceDecl,
  ThickenOp,
} from '@bushscad/ir';
import type { EvalCtx } from '../core/eval-types.js';
import { toSpan } from '../core/eval-context.js';
import { evalNum } from '../expressions/eval-expressions.js';
import { evalSingularSelection } from '../references/eval-resolved-selection.js';
import { materialForObject } from '../metadata/eval-material-resolution.js';
import { evalSurfaceInputName } from './eval-inline-operands.js';

/**
 * Emits IR for an open surface declaration.
 * Surface operations are previewable geometry but are not solid bodies until
 * converted through `thicken`, so they stay on their own evaluator path.
 */
export function evalSurfaceDecl(stmt: SurfaceDecl, ctx: EvalCtx): void {
  const irName = ctx.names.get(stmt.name) ?? stmt.name;
  ctx.names.set(stmt.name, irName);

  if (stmt.operation.kind === 'fill') {
    const selection = evalSingularSelection(
      stmt.operation.boundary,
      ctx,
      'fill',
    );
    ctx.ops.push({
      kind: 'surface',
      name: irName,
      boundary: selection.targets[0]?.label ?? '',
      selection,
      material: materialForObject(stmt.name, ctx),
      span: toSpan(stmt.span),
    } satisfies IRSurfaceFill);
    return;
  }

  ctx.ops.push({
    kind: 'surfaceOffset',
    name: irName,
    source: evalSurfaceInputName(stmt.operation.surface, ctx, stmt.name),
    distance: evalNum(stmt.operation.distance, ctx) * ctx.baseUnitMm,
    material: materialForObject(stmt.name, ctx),
    span: toSpan(stmt.span),
  } satisfies IRSurfaceOffset);
}

/**
 * Evaluates surface thicken with the current evaluation context.
 */
export function evalSurfaceThicken(
  astName: string,
  op: ThickenOp,
  ctx: EvalCtx,
): string {
  const irName = ctx.names.get(astName) ?? astName;
  ctx.ops.push({
    kind: 'surfaceThicken',
    objName: irName,
    surfaceName: evalSurfaceInputName(op.surface, ctx, astName),
    thickness: evalNum(op.thickness, ctx) * ctx.baseUnitMm,
    material: materialForObject(astName, ctx),
    span: toSpan(op.span),
  } satisfies IRSurfaceThicken);
  return irName;
}
