/**
 * @author Aidan Boissonneault
 * @file eval-object-op-placement.ts
 * @purpose Evaluates object op placement for the geometry in evaluator package.
 * @last-edited October 6, 2026
 */

import type {
  Expr,
  IRPlacement,
  RepeatableSpatialRef,
  SketchInput,
} from '@bushscad/ir';
import type { EvalCtx } from '../core/eval-types.js';
import { evalRepeatablePlacements } from '../references/eval-repeatable-refs.js';
import { evalSketchInputName } from './eval-inline-operands.js';

/** x/y offset expressions of a `@...` placement, for editable paramSpans. */
export function posOffsets(from: RepeatableSpatialRef | null | undefined): {
  x?: Expr;
  y?: Expr;
} {
  if (from && from.kind === 'pos') return { x: from.x, y: from.y };
  return {};
}

/**
 * Resolves a sketch input together with the operation placement it depends on.
 * Cut-like operations all need the same placement-before-inline-sketch ordering
 * so inline sketches can inherit the right face context.
 */
export function evalPlacedSketchInput(
  sketch: SketchInput,
  fromRef: RepeatableSpatialRef | null,
  astName: string,
  fallbackPlacement: IRPlacement | null,
  ctx: EvalCtx,
): { explicitFrom: IRPlacement | null; sketchIrName: string } {
  const explicitFrom = fromRef
    ? evalRepeatablePlacements(fromRef, ctx)[0]
    : fallbackPlacement;
  const sketchIrName = evalSketchInputName(
    sketch,
    ctx,
    astName,
    explicitFrom ?? ctx.activePlacement,
    fromRef !== null,
  );
  return { explicitFrom, sketchIrName };
}
