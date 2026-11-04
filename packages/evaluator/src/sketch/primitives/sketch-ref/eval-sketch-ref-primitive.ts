import type { IRPrimitive, SketchPrimitive } from '@bushscad/ir';
import type { EvalCtx } from '../../../core/eval-types.js';
import { addError } from '../../../core/eval-context.js';
import { clonePrimitive } from '../../../geometry/eval-primitive-clone.js';

/** Resolves a named sketch reference and clones its evaluated primitive. */
export function evalSketchRefPrimitive(
  primitive: Extract<SketchPrimitive, { kind: 'sketchRef' }>,
  ctx: EvalCtx,
): IRPrimitive | null {
  const irName = ctx.names.get(primitive.name) ?? primitive.name;
  const referenced = ctx.sketches.get(irName);
  if (!referenced) {
    addError(
      ctx,
      `Undefined sketch '${primitive.name}' in sketch expression`,
      primitive.span,
    );
    return null;
  }
  return clonePrimitive(referenced);
}
