/**
 * @author Aidan Boissonneault
 * @file evaluate-primitive.ts
 * @purpose Dispatches sketch primitive evaluation and applies sketch origin.
 * @last-edited November 4, 2026
 */

import type { IRPrimitive, SketchPrimitive } from '@bushscad/ir';
import type { EvalCtx } from '../../core/eval-types.js';
import { evalAdvancedSketchPrimitive } from '../eval-sketch-advanced.js';
import {
  evalPathSketchPrimitive,
  evalWrapSketchPrimitive,
} from '../eval-custom-sketch.js';
import { applySketchOrigin } from '../../geometry/eval-sketch-origin.js';
import { evalCirclePrimitive } from './circle/eval-circle-primitive.js';
import { evalInsetPrimitive } from './inset/eval-inset-primitive.js';
import { evalPolygonPrimitive } from './polygon/eval-polygon-primitive.js';
import { evalRectPrimitive } from './rect/eval-rect-primitive.js';
import { evalRoundRectPrimitive } from './roundrect/eval-roundrect-primitive.js';
import { evalSketchAtPrimitive } from './sketch-at/eval-sketch-at-primitive.js';
import { evalSketchBooleanPrimitive } from './boolean/eval-sketch-boolean-primitive.js';
import { evalSketchRefPrimitive } from './sketch-ref/eval-sketch-ref-primitive.js';
import { evalSketchAliasPrimitive } from './sketch-alias/eval-sketch-alias-primitive.js';
import { evalTrianglePrimitive } from './triangle/eval-triangle-primitive.js';
import { evalWordPrimitive } from './word/eval-word-primitive.js';
import type { PrimitiveEvaluator } from './types.js';

type CorePrimitiveKind =
  | 'rect'
  | 'circle'
  | 'roundrect'
  | 'triangle'
  | 'polygon'
  | 'pathSketch'
  | 'wrapSketch'
  | 'word'
  | 'inset'
  | 'sketchRef'
  | 'sketchBoolean'
  | 'sketchAlias'
  | 'sketchAt';

type CorePrimitiveEvaluator<Kind extends CorePrimitiveKind> = (
  primitive: Extract<SketchPrimitive, { kind: Kind }>,
  ctx: EvalCtx,
) => IRPrimitive | null;

const primitiveEvaluators = {
  rect: evalRectPrimitive,
  circle: evalCirclePrimitive,
  roundrect: evalRoundRectPrimitive,
  triangle: evalTrianglePrimitive,
  polygon: evalPolygonPrimitive,
  pathSketch: evalPathSketchPrimitive,
  wrapSketch: evalWrapSketchPrimitive,
  word: evalWordPrimitive,
  inset: evalInsetPrimitive,
  sketchRef: evalSketchRefPrimitive,
  sketchBoolean: (primitive, ctx) =>
    evalSketchBooleanPrimitive(primitive, ctx, evalPrimitive),
  sketchAlias: (primitive, ctx) =>
    evalSketchAliasPrimitive(primitive, ctx, evalPrimitive),
  sketchAt: (primitive, ctx) =>
    evalSketchAtPrimitive(primitive, ctx, evalPrimitive),
} satisfies {
  [Kind in CorePrimitiveKind]: CorePrimitiveEvaluator<Kind>;
};

/**
 * Evaluates a sketch AST primitive and applies its source-level origin.
 *
 * Why:
 * This dispatcher preserves shared sequencing while each primitive handler
 * owns its expression evaluation and metadata rules.
 */
export function evalPrimitive(
  primitive: SketchPrimitive,
  ctx: EvalCtx,
): IRPrimitive | null {
  const evaluated = evalPrimitiveCore(primitive, ctx);
  if (!evaluated) return null;
  return applySketchOrigin(evaluated, primitive);
}

/** Evaluates one primitive, delegating advanced syntax before core forms. */
function evalPrimitiveCore(
  primitive: SketchPrimitive,
  ctx: EvalCtx,
): IRPrimitive | null {
  const advanced = evalAdvancedSketchPrimitive(primitive, ctx, evalPrimitive);
  if (advanced.handled) return advanced.primitive;
  const evaluator = primitiveEvaluators[primitive.kind as CorePrimitiveKind] as
    | PrimitiveEvaluator
    | undefined;
  return evaluator ? evaluator(primitive, ctx) : null;
}
