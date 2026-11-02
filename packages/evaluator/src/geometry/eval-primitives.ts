/**
 * @author Aidan Boissonneault
 * @file eval-primitives.ts
 * @purpose Evaluates primitives for the geometry in evaluator package.
 * @last-edited October 6, 2026
 */

import type { IRPrimitive, SketchPrimitive } from '@bushscad/ir';
import type { EvalCtx } from '../core/eval-types.js';
import { addError } from '../core/eval-context.js';
import {
  evalAxisExpr,
  evalFont,
  evalNum,
  evalStr,
} from '../expressions/eval-expressions.js';
import {
  profileClosed,
  requireClosedSketch,
  requireOpenGuideSketch,
} from '../sketch/eval-profile-validation.js';
import {
  evalPathSketchPrimitive,
  evalWrapSketchPrimitive,
} from '../sketch/eval-custom-sketch.js';
import { evalAdvancedSketchPrimitive } from '../sketch/eval-sketch-advanced.js';
import { clonePrimitive } from './eval-primitive-clone.js';
import { evalRectPrimitive } from './eval-rect-primitive.js';
import { applySketchOrigin } from './eval-sketch-origin.js';
import { evalCompactSketchDimensions } from '../sketch/eval-compact-sketch-dimensions.js';

export { profileClosed, requireClosedSketch, requireOpenGuideSketch };

/**
 * Accepted values for core primitive kind are 'rect', 'circle', 'roundrect', 'triangle',
 * 'polygon', 'pathSketch', 'wrapSketch', 'word', 'inset', 'sketchRef',
 * 'sketchBoolean', 'sketchAlias', and 'sketchAt'.
 */
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

/**
 * Defines the `CorePrimitiveEvaluator` callback contract used by the geometry layer.
 */
type CorePrimitiveEvaluator<Kind extends CorePrimitiveKind> = (
  prim: Extract<SketchPrimitive, { kind: Kind }>,
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
  sketchBoolean: evalSketchBooleanPrimitive,
  sketchAlias: evalSketchAliasPrimitive,
  sketchAt: evalSketchAtPrimitive,
} satisfies {
  [Kind in CorePrimitiveKind]: CorePrimitiveEvaluator<Kind>;
};

/**
 * Evaluates a sketch primitive AST node into its IR form.
 *
 * Converts source-level expressions into concrete sketch dimensions before the
 * OCCT bridge builds geometry.
 */
export function evalPrimitive(
  prim: SketchPrimitive,
  ctx: EvalCtx,
): IRPrimitive | null {
  const evaluated = evalPrimitiveCore(prim, ctx);
  if (!evaluated) return null;
  return applySketchOrigin(evaluated, prim);
}

/**
 * Evaluates primitive core with the current evaluation context.
 */
function evalPrimitiveCore(
  prim: SketchPrimitive,
  ctx: EvalCtx,
): IRPrimitive | null {
  const advanced = evalAdvancedSketchPrimitive(prim, ctx, evalPrimitive);
  if (advanced.handled) return advanced.primitive;
  const evaluator = primitiveEvaluators[prim.kind as CorePrimitiveKind] as
    | ((prim: SketchPrimitive, ctx: EvalCtx) => IRPrimitive | null)
    | undefined;
  return evaluator ? evaluator(prim, ctx) : null;
}

/**
 * Evaluates sketch ref primitive with the current evaluation context.
 */
function evalSketchRefPrimitive(
  prim: Extract<SketchPrimitive, { kind: 'sketchRef' }>,
  ctx: EvalCtx,
): IRPrimitive | null {
  const irName = ctx.names.get(prim.name) ?? prim.name;
  const referenced = ctx.sketches.get(irName);
  if (!referenced) {
    addError(
      ctx,
      `Undefined sketch '${prim.name}' in sketch expression`,
      prim.span,
    );
    return null;
  }
  return clonePrimitive(referenced);
}

/**
 * Evaluates circle primitive with the current evaluation context.
 */
function evalCirclePrimitive(
  prim: Extract<SketchPrimitive, { kind: 'circle' }>,
  ctx: EvalCtx,
): IRPrimitive {
  const evaluated: Extract<IRPrimitive, { kind: 'circle' }> = {
    kind: 'circle',
    diameter: evalNum(prim.diameter, ctx),
  };
  const dimensions = evalCompactSketchDimensions(prim.compactDimensions, ctx);
  if (dimensions) evaluated.dimensions = dimensions;
  return evaluated;
}

/**
 * Evaluates round rect primitive with the current evaluation context.
 */
function evalRoundRectPrimitive(
  prim: Extract<SketchPrimitive, { kind: 'roundrect' }>,
  ctx: EvalCtx,
): IRPrimitive {
  return {
    kind: 'roundrect',
    width: evalNum(prim.width, ctx),
    height: evalNum(prim.height, ctx),
    radius: evalNum(prim.radius, ctx),
  };
}

/**
 * Evaluates triangle primitive with the current evaluation context.
 */
function evalTrianglePrimitive(
  prim: Extract<SketchPrimitive, { kind: 'triangle' }>,
  ctx: EvalCtx,
): IRPrimitive {
  return {
    kind: 'triangle',
    base: evalNum(prim.base, ctx),
    height: evalNum(prim.height, ctx),
  };
}

/**
 * Evaluates polygon primitive with the current evaluation context.
 */
function evalPolygonPrimitive(
  prim: Extract<SketchPrimitive, { kind: 'polygon' }>,
  ctx: EvalCtx,
): IRPrimitive {
  return {
    kind: 'polygon',
    points: prim.points.map(([x, y]) => [evalNum(x, ctx), evalNum(y, ctx)]),
    plant: prim.plant,
  };
}

/**
 * Evaluates word primitive with the current evaluation context.
 */
function evalWordPrimitive(
  prim: Extract<SketchPrimitive, { kind: 'word' }>,
  ctx: EvalCtx,
): IRPrimitive {
  return {
    kind: 'word',
    text: evalStr(prim.text, ctx),
    size: evalNum(prim.size, ctx),
    font: evalFont(prim.font, ctx),
    align: prim.align ?? 'center',
  };
}

/**
 * Evaluates inset primitive with the current evaluation context.
 */
function evalInsetPrimitive(
  prim: Extract<SketchPrimitive, { kind: 'inset' }>,
  ctx: EvalCtx,
): IRPrimitive | null {
  const parent = ctx.thisContext;
  if (!parent) {
    addError(
      ctx,
      `'inset' sketch primitive requires a parent sketching context`,
      prim.span,
    );
    return null;
  }
  const dimensions = insetDimensions(parent, evalInsetOffsets(prim, ctx));
  if (!validInsetDimensions(dimensions, prim.span, ctx)) return null;
  return { kind: 'rect', ...dimensions };
}

/**
 * Evaluates inset offsets with the current evaluation context.
 */
function evalInsetOffsets(
  prim: Extract<SketchPrimitive, { kind: 'inset' }>,
  ctx: EvalCtx,
): { left: number; right: number; top: number; bottom: number } {
  const all = prim.all !== undefined ? evalNum(prim.all, ctx) : 0;
  const x = prim.x !== undefined ? evalNum(prim.x, ctx) : all;
  const y = prim.y !== undefined ? evalNum(prim.y, ctx) : all;
  const left = prim.sides !== undefined ? evalNum(prim.sides, ctx) : x;
  return {
    left,
    right: left,
    top: prim.top !== undefined ? evalNum(prim.top, ctx) : y,
    bottom: prim.bottom !== undefined ? evalNum(prim.bottom, ctx) : y,
  };
}

/**
 * Handles inset dimensions in the geometry flow.
 */
function insetDimensions(
  parent: { width: number; height: number },
  offsets: { left: number; right: number; top: number; bottom: number },
): { width: number; height: number } {
  return {
    width: parent.width - offsets.left - offsets.right,
    height: parent.height - offsets.top - offsets.bottom,
  };
}

/**
 * Returns a valid inset dimensions value, or null when no candidate is usable.
 */
function validInsetDimensions(
  dimensions: { width: number; height: number },
  span: Extract<SketchPrimitive, { kind: 'inset' }>['span'],
  ctx: EvalCtx,
): boolean {
  if (dimensions.width <= 0 || dimensions.height <= 0) {
    addError(
      ctx,
      `Inset produces non-positive rectangle dimensions (${dimensions.width} x ${dimensions.height})`,
      span,
    );
    return false;
  }
  return true;
}

/**
 * Evaluates sketch boolean primitive with the current evaluation context.
 */
function evalSketchBooleanPrimitive(
  prim: Extract<SketchPrimitive, { kind: 'sketchBoolean' }>,
  ctx: EvalCtx,
): IRPrimitive | null {
  const left = evalPrimitive(prim.left, ctx);
  const right = evalPrimitive(prim.right, ctx);
  if (!left || !right) return null;
  validateBooleanOperand(left, prim.left.span, ctx);
  validateBooleanOperand(right, prim.right.span, ctx);
  return { kind: 'sketchBoolean', op: prim.op, left, right };
}

/**
 * Evaluates sketch alias primitive with the current evaluation context.
 */
function evalSketchAliasPrimitive(
  prim: Extract<SketchPrimitive, { kind: 'sketchAlias' }>,
  ctx: EvalCtx,
): IRPrimitive | null {
  const primitive = evalPrimitive(prim.primitive, ctx);
  return primitive ? { kind: 'sketchAlias', name: prim.name, primitive } : null;
}

/**
 * Evaluates sketch at primitive with the current evaluation context.
 */
function evalSketchAtPrimitive(
  prim: Extract<SketchPrimitive, { kind: 'sketchAt' }>,
  ctx: EvalCtx,
): IRPrimitive | null {
  const primitive = evalPrimitive(prim.primitive, ctx);
  if (!primitive) return null;
  return {
    kind: 'sketchAt',
    primitive,
    x: evalAxisExpr(prim.x, 'x', ctx),
    y: evalAxisExpr(prim.y, 'y', ctx),
  };
}

/**
 * Validates boolean operand and reports any violations.
 */
function validateBooleanOperand(
  prim: IRPrimitive,
  span: import('@bushscad/ir').ASTSourceSpan,
  ctx: EvalCtx,
): void {
  if (containsOpenProfile(prim)) {
    addError(
      ctx,
      'Sketch boolean operands must be closed filled profiles',
      span,
    );
  }
}

/**
 * Handles contains open profile in the geometry flow.
 */
function containsOpenProfile(prim: IRPrimitive): boolean {
  if (prim.kind === 'profile') return !profileClosed(prim);
  if (prim.kind === 'sketchAt') return containsOpenProfile(prim.primitive);
  if (prim.kind === 'sketchAlias') return containsOpenProfile(prim.primitive);
  if (prim.kind === 'sketchBoolean') {
    return containsOpenProfile(prim.left) || containsOpenProfile(prim.right);
  }
  if (prim.kind === 'sketchRef') return false;
  return false;
}
