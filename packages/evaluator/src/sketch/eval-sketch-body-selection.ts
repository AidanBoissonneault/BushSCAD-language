/**
 * @author Aidan Boissonneault
 * @file eval-sketch-body-selection.ts
 * @purpose Evaluates sketch body selection for the sketch in evaluator package.
 * @last-edited October 6, 2026
 */

import {
  profileSelectionSource,
  type ASTSourceSpan,
  type SketchInput,
} from '@bushscad/ir';
import type { EvalCtx } from '../core/eval-types.js';
import { addError } from '../core/eval-context.js';
import { closedBodyNamesForSketchInput } from '../geometry/eval-inline-operands.js';

/**
 * Validates and returns selected closed-body names for a sketch operand.
 * Body names are scoped to the solved sketch profile, so validation must run
 * after inline/named sketch operands have been lowered to IR profile metadata.
 */
export function evalSketchBodySelection(
  input: SketchInput,
  sketchName: string,
  span: ASTSourceSpan,
  ctx: EvalCtx,
): string[] | undefined {
  const selected = closedBodyNamesForSketchInput(input);
  if (!selected?.length) return undefined;
  const profile = profileSelectionSource(ctx.sketches.get(sketchName))?.profile;
  const bodies = profile?.closedBodies ?? [];
  const selections = profile?.bodySelections ?? [];
  const names = new Set([
    ...bodies.flatMap(
      (body) => [body.id, body.name].filter(Boolean) as string[],
    ),
    ...selections.map((selection) => selection.name),
  ]);
  for (const name of selected) {
    if (!names.has(name)) {
      addError(
        ctx,
        `Closed body '${name}' was not found in sketch '${sketchName}'`,
        span,
      );
    }
  }
  return selected;
}
