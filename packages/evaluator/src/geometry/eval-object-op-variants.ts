/**
 * @author Aidan Boissonneault
 * @file eval-object-op-variants.ts
 * @purpose Evaluates object op variants for the geometry in evaluator package.
 * @last-edited October 6, 2026
 */

import type { ObjectOperation, SketchInput } from '@bushscad/ir';
import type { EvalCtx } from '../core/eval-types.js';
import { expandSpatialRefs } from '../references/eval-repeatable-refs.js';

/**
 * Produces one object operation per concrete placement and sketch target.
 * Source-level array operands are repeated operations in IR, but each repeated
 * operation must keep the legacy single-placement AST shape before lowering.
 */
export function expandObjectOperationVariants(
  op: ObjectOperation,
  ctx: EvalCtx,
): ObjectOperation[] {
  return expandObjectSketchVariants(op).flatMap((variant) =>
    expandObjectPlacementVariants(variant, ctx),
  );
}

/**
 * Expands object sketch variants into its concrete entries.
 */
function expandObjectSketchVariants(op: ObjectOperation): ObjectOperation[] {
  if ('sketch' in op) {
    const sketches = expandSketchInput(op.sketch);
    if (sketches.length <= 1)
      return [{ ...op, sketch: sketches[0] ?? op.sketch }];
    return sketches.map((sketch) => ({ ...op, sketch }) as ObjectOperation);
  }
  if (op.kind !== 'loft') return [op];

  const profileCombos = cartesianSketchInputs(
    op.sketches.map(expandSketchInput),
  );
  const guideOptions = op.guide ? expandSketchInput(op.guide) : [null];
  return profileCombos.flatMap((sketches) =>
    guideOptions.map(
      (guide) => ({ ...op, sketches, guide }) as ObjectOperation,
    ),
  );
}

/**
 * Expands sketch input into its concrete entries.
 */
function expandSketchInput(input: SketchInput): SketchInput[] {
  if (input.kind !== 'sketchList') return [input];
  return input.items.flatMap(expandSketchInput);
}

/**
 * Handles cartesian sketch inputs in the geometry flow.
 */
function cartesianSketchInputs(options: SketchInput[][]): SketchInput[][] {
  return options.reduce<SketchInput[][]>(
    (sets, option) =>
      sets.flatMap((set) => option.map((item) => [...set, item])),
    [[]],
  );
}

/**
 * Expands object placement variants into its concrete entries.
 */
function expandObjectPlacementVariants(
  op: ObjectOperation,
  ctx: EvalCtx,
): ObjectOperation[] {
  if (op.kind === 'solidPrimitive') {
    return expandSolidPrimitivePlacementVariants(op, ctx);
  }
  if (!('from' in op) || !op.from) return [op];

  const placements = expandSpatialRefs(op.from, ctx);
  if (placements.length <= 1) {
    return placements.length === 0 ? [op] : [{ ...op, from: placements[0] }];
  }
  return placements.map((from) => ({ ...op, from }) as ObjectOperation);
}

/**
 * Expands solid primitive placement variants into its concrete entries.
 */
function expandSolidPrimitivePlacementVariants(
  op: Extract<ObjectOperation, { kind: 'solidPrimitive' }>,
  ctx: EvalCtx,
): ObjectOperation[] {
  if (!op.placement) return [op];
  const placements = expandSpatialRefs(op.placement, ctx);
  if (placements.length <= 1) {
    return placements.length === 0
      ? [op]
      : [{ ...op, placement: placements[0] }];
  }
  return placements.map(
    (placement) => ({ ...op, placement }) as ObjectOperation,
  );
}
