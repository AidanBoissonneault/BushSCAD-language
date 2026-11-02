/**
 * @author Aidan Boissonneault
 * @file eval-through-target.ts
 * @purpose Evaluates through target for the geometry in evaluator package.
 * @last-edited October 6, 2026
 */

import type { IRPlacement, ThroughTarget } from '@bushscad/ir';
import type { EvalCtx } from '../core/eval-types.js';
import { addError } from '../core/eval-context.js';

/**
 * Resolves a source `through` target into the IR body name it cuts through.
 * M41 allows `through` to omit the body when the placement surface already
 * names the owning body. Keeping the inference here makes cut, sweep_cut, and
 * hole lowering use one rule.
 */
export function evalThroughTargetName(
  through: ThroughTarget,
  from: IRPlacement | null,
  ctx: EvalCtx,
): string | null {
  if (!through) return null;
  if (through.kind === 'namedThrough') {
    return ctx.names.get(through.name) ?? through.name;
  }

  const owner = from?.faceRef ? ownerFromPlacementFace(from.faceRef) : null;
  if (owner) return owner;
  addError(
    ctx,
    `through without a body requires a placement surface with a clear owning object`,
    through.span,
  );
  return null;
}

/**
 * Handles owner from placement face in the geometry flow.
 */
function ownerFromPlacementFace(faceRef: string): string | null {
  const first = faceRef.split('.')[0];
  return first && !first.includes(',') ? first : null;
}
