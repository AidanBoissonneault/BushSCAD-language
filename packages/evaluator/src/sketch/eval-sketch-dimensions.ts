/**
 * @author Aidan Boissonneault
 * @file eval-sketch-dimensions.ts
 * @purpose Evaluates sketch dimensions for the sketch in evaluator package.
 * @last-edited October 6, 2026
 */

import type { ASTSourceSpan, IRPrimitive } from '@bushscad/ir';
import { sketchPreviewPrimitiveBounds } from '@bushscad/ir';
import type { EvalCtx } from '../core/eval-types.js';
import { addError } from '../core/eval-context.js';

/**
 * Reads a sketch dimension from its evaluated primitive bounds.
 * `sketch.width`, `sketch.height`, and legacy `sketch.length` are expression-level
 * shortcuts that must
 * work for simple primitives, placed operands, and boolean composites.
 */
export function evalSketchDimension(
  ctx: EvalCtx,
  sketchName: string,
  property: string,
  span: ASTSourceSpan,
): number | null {
  const irName = ctx.names.get(sketchName) ?? sketchName;
  const primitive = ctx.sketches.get(irName);
  if (!primitive) return null;
  if (property !== 'width' && property !== 'height' && property !== 'length') {
    addError(ctx, `Unknown sketch dimension '${sketchName}.${property}'`, span);
    return 0;
  }
  const bounds = sketchPreviewPrimitiveBounds(
    resolveSketchRefs(primitive, ctx, span),
  );
  return property === 'width' ? bounds.width : bounds.height;
}

/**
 * Expands any retained sketch-reference IR nodes before computing bounds.
 * Most references are lowered during evaluation, but this keeps dimension
 * lookup robust for imported or future IR producers that preserve references.
 */
function resolveSketchRefs(
  primitive: IRPrimitive,
  ctx: EvalCtx,
  span: ASTSourceSpan,
): IRPrimitive {
  if (primitive.kind === 'sketchRef') {
    const referenced = ctx.sketches.get(primitive.name);
    if (!referenced) {
      addError(ctx, `Undefined sketch '${primitive.name}'`, span);
      return { kind: 'rect', width: 0, height: 0 };
    }
    return resolveSketchRefs(referenced, ctx, span);
  }
  if (primitive.kind === 'sketchAt') {
    return {
      ...primitive,
      primitive: resolveSketchRefs(primitive.primitive, ctx, span),
    };
  }
  if (primitive.kind === 'sketchBoolean') {
    return {
      ...primitive,
      left: resolveSketchRefs(primitive.left, ctx, span),
      right: resolveSketchRefs(primitive.right, ctx, span),
    };
  }
  return primitive;
}
