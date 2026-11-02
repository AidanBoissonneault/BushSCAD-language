/**
 * @author Aidan Boissonneault
 * @file eval-sketch-origin.ts
 * @purpose Evaluates sketch origin for the geometry in evaluator package.
 * @last-edited October 6, 2026
 */

import type { IRPrimitive, SketchPrimitive } from '@bushscad/ir';
import { sketchPreviewPrimitiveBounds } from '@bushscad/ir';

/**
 * Re-anchors an evaluated sketch without changing its authored geometry.
 * `origin: corner` is a source-level placement convention. Lowering it to the
 * existing `sketchAt` primitive keeps geometry consumers on one translation
 * model while retaining metadata on the nested primitive.
 */
export function applySketchOrigin(
  primitive: IRPrimitive,
  source: SketchPrimitive,
): IRPrimitive {
  const origin = 'origin' in source ? source.origin : undefined;
  if (origin !== 'corner') return primitive;
  const bounds = sketchPreviewPrimitiveBounds(primitive);
  return {
    kind: 'sketchAt',
    primitive,
    x: cleanZero(-bounds.minX),
    y: cleanZero(-bounds.maxY),
  };
}

/**
 * Handles clean zero in the geometry flow.
 */
function cleanZero(value: number): number {
  return Object.is(value, -0) ? 0 : value;
}
