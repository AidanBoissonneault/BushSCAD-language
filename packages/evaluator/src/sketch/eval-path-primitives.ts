/**
 * @author Aidan Boissonneault
 * @file eval-path-primitives.ts
 * @purpose Evaluates path primitives for the sketch in evaluator package.
 * @last-edited October 6, 2026
 */

import type {
  EvaluatedCompactPathPrimitive,
  IRProfileSegment,
  PathEmbeddedPrimitive,
  PathPrimitiveItem,
} from '@bushscad/ir';
import {
  compactPathPrimitiveSegments,
  uniqueNameWithSuffix,
} from '@bushscad/ir';
import type { EvalCtx } from '../core/eval-types.js';
import { addError } from '../core/eval-context.js';
import { evalAxisExpr, evalNum } from '../expressions/eval-expressions.js';
import { evalRectPrimitive } from '../geometry/eval-rect-primitive.js';
import { applySketchOrigin } from '../geometry/eval-sketch-origin.js';
import type { PathEvalState } from './eval-path-segments.js';
import { validateArcRadius } from './eval-profile-validation.js';
import { evalEllipseSketch } from './eval-ellipse-sketch.js';

/**
 * Materializes one compact mixed-path primitive without advancing its cursor.
 * Rectangles and circles must coexist with independent construction paths. A
 * flat profile keeps existing solvers and geometry consumers unchanged while
 * editor-canonical names restore primitive intent on visual reimport.
 */
export function lowerPathPrimitiveItem(
  item: PathPrimitiveItem,
  state: PathEvalState,
  ctx: EvalCtx,
): void {
  state.shapeCount += 1;
  const evaluated = evalEmbeddedPrimitive(item.primitive, ctx);
  if (!evaluated) return;
  const segments = compactPathPrimitiveSegments(
    evaluated,
    state.shapeCount,
    (base) => reserveName(base, state),
  );
  if (!segments) {
    addError(
      ctx,
      'Rounded rect(...) entries cannot be embedded in path(); use explicit arcs or a zero corner radius.',
      item.span,
    );
    return;
  }
  const authoredSegments = item.construction
    ? segments.map((segment) => ({ ...segment, construction: true }))
    : segments;
  validatePrimitiveArcs(authoredSegments, item, ctx);
  registerPrimitiveEndpoints(authoredSegments, state);
  for (const segment of authoredSegments)
    state.fixedSegmentNames.add(segment.name);
  state.plantCount += authoredSegments.filter(
    (segment) => segment.kind === 'line' && segment.plant,
  ).length;
  state.segments.push(...authoredSegments);
}

/**
 * Evaluates embedded primitive with the current evaluation context.
 */
function evalEmbeddedPrimitive(
  primitive: PathEmbeddedPrimitive,
  ctx: EvalCtx,
): EvaluatedCompactPathPrimitive | null {
  if (primitive.kind === 'sketchAt') {
    const nested = evalEmbeddedPrimitive(primitive.primitive, ctx);
    if (!nested) return null;
    return {
      kind: 'sketchAt',
      primitive: nested,
      x: evalAxisExpr(primitive.x, 'x', ctx),
      y: evalAxisExpr(primitive.y, 'y', ctx),
    };
  }
  const evaluated = evalEmbeddedBase(primitive, ctx);
  if (!evaluated) return null;
  return applySketchOrigin(
    evaluated,
    primitive,
  ) as EvaluatedCompactPathPrimitive;
}

/**
 * Evaluates embedded base with the current evaluation context.
 */
function evalEmbeddedBase(
  primitive: Exclude<PathEmbeddedPrimitive, { kind: 'sketchAt' }>,
  ctx: EvalCtx,
): Exclude<EvaluatedCompactPathPrimitive, { kind: 'sketchAt' }> | null {
  if (primitive.kind === 'rect') return evalRectPrimitive(primitive, ctx);
  if (primitive.kind === 'circle') {
    return { kind: 'circle', diameter: evalNum(primitive.diameter, ctx) };
  }
  const evaluated = evalEllipseSketch(primitive, ctx);
  return evaluated?.kind === 'ellipse' || evaluated?.kind === 'circle'
    ? evaluated
    : null;
}

/**
 * Handles reserve name in the sketch flow.
 */
function reserveName(base: string, state: PathEvalState): string {
  const name = uniqueNameWithSuffix(base, state.usedNames);
  state.usedNames.add(name);
  return name;
}

/**
 * Validates primitive arcs and reports any violations.
 */
function validatePrimitiveArcs(
  segments: IRProfileSegment[],
  item: PathPrimitiveItem,
  ctx: EvalCtx,
): void {
  for (const segment of segments) {
    if (segment.kind === 'arc') {
      validateArcRadius(
        segment.name,
        segment.from,
        segment.to,
        segment.radius,
        item.span,
        ctx,
      );
    }
  }
}

/**
 * Handles register primitive endpoints in the sketch flow.
 */
function registerPrimitiveEndpoints(
  segments: IRProfileSegment[],
  state: PathEvalState,
): void {
  const localPoints = new Map<string, string>();
  for (const segment of segments) {
    registerEndpoint(segment.name, 'start', segment.from, localPoints, state);
    registerEndpoint(segment.name, 'end', segment.to, localPoints, state);
  }
}

/**
 * Handles register endpoint in the sketch flow.
 */
function registerEndpoint(
  segmentName: string,
  endpoint: 'start' | 'end',
  point: [number, number],
  localPoints: Map<string, string>,
  state: PathEvalState,
): void {
  const alias = `${segmentName}.${endpoint}`;
  const key = pointKey(point);
  const canonical = localPoints.get(key) ?? alias;
  localPoints.set(key, canonical);
  state.aliases.set(alias, canonical);
  if (!state.points.has(canonical)) state.points.set(canonical, point);
}

/**
 * Creates point geometry from the supplied coordinates.
 */
function pointKey(point: [number, number]): string {
  return point.map((value) => (Object.is(value, -0) ? 0 : value)).join(':');
}
