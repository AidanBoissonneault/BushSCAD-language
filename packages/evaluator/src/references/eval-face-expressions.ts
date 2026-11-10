/**
 * @author Aidan Boissonneault
 * @file eval-face-expressions.ts
 * @purpose Evaluates face expressions for the references in evaluator package.
 * @last-edited October 6, 2026
 */

import type { FaceRef, FaceRefList } from '@bushscad/ir';
import type { EvalCtx, EvalValue } from '../core/eval-types.js';
import { isPointTuple, valueType } from '../core/eval-types.js';
import { addError } from '../core/eval-context.js';
import { evalSketchDimension } from '../sketch/eval-sketch-dimensions.js';
import {
  expandFaceRefForEval,
  expandRepeatableFaceRefForEval,
} from './eval-reference-expansion.js';
import {
  materializeInlineObjectReference,
  serializeFaceRef,
} from './eval-face-serialization.js';
export {
  FACE_WORDS,
  asFaceRefValue,
  materializeInlineObjectReference,
  serializeAnchorTarget,
  serializeFaceRef,
  serializeFaceRefSegments,
} from './eval-face-serialization.js';

/**
 * Type used for face metric value.
 */
type FaceMetricValue = NonNullable<
  EvalCtx['faceMetrics'] extends Map<string, infer Value> ? Value : never
>;
/**
 * Accepted values for face metric property are 'width', 'height', 'length', 'area', 'center',
 * and 'normal'.
 */
type FaceMetricProperty =
  | 'width'
  | 'height'
  | 'length'
  | 'area'
  | 'center'
  | 'normal';
const FACE_METRIC_READERS: Record<
  FaceMetricProperty,
  (metrics: FaceMetricValue) => EvalValue
> = {
  width: (metrics) => metrics.width,
  height: (metrics) => metrics.height,
  length: (metrics) => metrics.height,
  area: (metrics) => metrics.area,
  center: (metrics) => metrics.center,
  normal: (metrics) => metrics.normal,
};

/**
 * Evaluates face ref expr with the current evaluation context.
 */
export function evalFaceRefExpr(ref: FaceRef, ctx: EvalCtx): EvalValue {
  const resolvedRef = materializeInlineObjectReference(ref, ctx);
  const expanded = expandFaceRefForEval(resolvedRef, ctx);
  if (expanded.length > 1) {
    return expanded.map((item) => evalFaceRefExpr(item, ctx));
  }
  const namedValue = evalTwoNameFaceRef(resolvedRef, ctx);
  if (namedValue !== null) return namedValue;
  const metricValue = evalFaceMetricProperty(resolvedRef, ctx);
  if (metricValue !== null) return metricValue;
  return { kind: 'faceRefValue', label: serializeFaceRef(resolvedRef, ctx) };
}

/**
 * Evaluates face ref list expr with the current evaluation context.
 */
export function evalFaceRefListExpr(ref: FaceRefList, ctx: EvalCtx): EvalValue {
  return expandRepeatableFaceRefForEval(ref, ctx).map((item) =>
    evalFaceRefExpr(item, ctx),
  );
}

/**
 * Evaluates two name face ref with the current evaluation context.
 */
function evalTwoNameFaceRef(ref: FaceRef, ctx: EvalCtx): EvalValue | null {
  const names = twoNameRefParts(ref);
  if (!names) return null;
  const [root, prop] = names;
  const sketchDim = evalSketchDimension(ctx, root, prop, ref.span);
  if (sketchDim !== null) return sketchDim;
  return evalPointTupleCoordinate(root, prop, ref, ctx);
}

/**
 * Handles two name ref parts in the references flow.
 */
function twoNameRefParts(ref: FaceRef): [string, string] | null {
  if (
    ref.chain.length === 2 &&
    ref.chain[0].kind === 'name' &&
    ref.chain[1].kind === 'name'
  ) {
    return [ref.chain[0].value, ref.chain[1].value];
  }
  return null;
}

/**
 * Evaluates point tuple coordinate with the current evaluation context.
 */
function evalPointTupleCoordinate(
  root: string,
  prop: string,
  ref: FaceRef,
  ctx: EvalCtx,
): EvalValue | null {
  if (prop !== 'x' && prop !== 'y') return null;
  const val = ctx.values.get(root);
  if (val === undefined) return null;
  if (isPointTuple(val)) return prop === 'x' ? val[0] : val[1];
  addError(
    ctx,
    `Expected point tuple for '${root}.${prop}', got ${valueType(val)}`,
    ref.span,
  );
  return 0;
}

/**
 * Evaluates face metric property with the current evaluation context.
 */
function evalFaceMetricProperty(ref: FaceRef, ctx: EvalCtx): EvalValue | null {
  const last = ref.chain[ref.chain.length - 1];
  if (!last || last.kind !== 'name') return null;
  const readMetric = faceMetricReader(last.value);
  if (!readMetric) return null;

  const baseRef: FaceRef = { ...ref, chain: ref.chain.slice(0, -1) };
  const key = serializeFaceRef(baseRef, ctx);
  const metrics = ctx.faceMetrics.get(key);
  if (!metrics) return null;

  return readMetric(metrics);
}

/**
 * Resolves the face data required by the current selector.
 */
function faceMetricReader(
  property: string,
): ((metrics: FaceMetricValue) => EvalValue) | null {
  return FACE_METRIC_READERS[property as FaceMetricProperty] ?? null;
}
