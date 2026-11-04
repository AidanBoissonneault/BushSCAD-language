/**
 * @author Aidan Boissonneault
 * @file eval-path-segments.ts
 * @purpose Evaluates path segments for the sketch in evaluator package.
 * @last-edited October 6, 2026
 */

import type {
  ASTSourceSpan,
  IRProfileSegment,
  PathSegmentItem,
  PathSketchPrimitive,
} from '@bushscad/ir';
import type { EvalCtx } from '../core/eval-types.js';
import { addError } from '../core/eval-context.js';
import { evalNum } from '../expressions/eval-expressions.js';
import { validateArcRadius } from './eval-profile-validation.js';
import { nextPathSegmentName } from './eval-path-names.js';
import { lowerPathPrimitiveItem } from './eval-path-primitives.js';

/**
 * State for path eval, including start, start name, cursor, cursor name, and loop closed.
 */
export type PathEvalState = {
  start: [number, number] | null;
  startName: string | null;
  cursor: [number, number] | null;
  cursorName: string | null;
  loopClosed: boolean;
  segments: IRProfileSegment[];
  points: Map<string, [number, number]>;
  aliases: Map<string, string>;
  usedNames: Set<string>;
  fixedSegmentNames: Set<string>;
  generatedCount: number;
  shapeCount: number;
  plantCount: number;
};

/** Lowers cursor-based path items and records the shared endpoint alias graph. */
export function lowerPathItems(
  prim: PathSketchPrimitive,
  ctx: EvalCtx,
): PathEvalState {
  const state: PathEvalState = {
    start: null,
    startName: null,
    cursor: null,
    cursorName: null,
    loopClosed: false,
    segments: [],
    points: new Map(),
    aliases: new Map(),
    usedNames: new Set(),
    fixedSegmentNames: new Set(),
    generatedCount: 0,
    shapeCount: 0,
    plantCount: 0,
  };
  let segmentIndex = 0;
  for (const item of prim.items) {
    if (item.kind === 'primitive') {
      lowerPathPrimitiveItem(item, state, ctx);
    } else {
      evalPathItem(item, segmentIndex, state, ctx);
      segmentIndex += 1;
    }
  }
  if (state.plantCount > 1) {
    addError(ctx, 'Only one profile line can be marked plant', prim.span);
  }
  return state;
}

/**
 * Evaluates path item with the current evaluation context.
 */
function evalPathItem(
  item: PathSegmentItem,
  index: number,
  state: PathEvalState,
  ctx: EvalCtx,
): void {
  const name = nextPathSegmentName(item, state);
  if (item.plant) {
    if (item.segment.kind !== 'line') {
      addError(
        ctx,
        'plant can only mark named line elements in path().',
        item.span,
      );
    }
    state.plantCount++;
  }
  if (index === 0 && !firstItemEstablishesStart(item)) {
    addError(
      ctx,
      'The first segment in path() must establish a start point. Use line((x1, y1), (x2, y2)) for the first segment.',
      item.span,
    );
  }
  const segment = lowerPathSegment(item, name, state, ctx);
  if (segment) state.segments.push(segment);
}

/**
 * Returns the first item establishes start that matches the requested condition.
 */
function firstItemEstablishesStart(item: PathSegmentItem): boolean {
  return (
    (item.segment.kind === 'line' || item.segment.kind === 'arc') &&
    item.segment.form === 'explicit'
  );
}

/**
 * Handles lower path segment in the sketch flow.
 */
function lowerPathSegment(
  item: PathSegmentItem,
  name: string,
  state: PathEvalState,
  ctx: EvalCtx,
): IRProfileSegment | null {
  if (item.segment.kind === 'line')
    return lowerPathLine(item, name, state, ctx);
  if (item.segment.kind === 'arc') return lowerPathArc(item, name, state, ctx);
  return lowerPathClose(item, name, state, ctx);
}

/**
 * Handles lower path line in the sketch flow.
 */
function lowerPathLine(
  item: PathSegmentItem,
  name: string,
  state: PathEvalState,
  ctx: EvalCtx,
): IRProfileSegment | null {
  const segment = item.segment;
  if (segment.kind !== 'line') return null;
  const { from, to } = lowerPathEndpoint(segment, item, name, state, ctx);
  registerPathEndpoint(state, name, from, to);
  return {
    kind: 'line',
    name,
    from: from.point,
    to,
    plant: item.plant,
    construction: item.construction,
  };
}

/**
 * Handles lower path arc in the sketch flow.
 */
function lowerPathArc(
  item: PathSegmentItem,
  name: string,
  state: PathEvalState,
  ctx: EvalCtx,
): IRProfileSegment | null {
  const segment = item.segment;
  if (segment.kind !== 'arc') return null;
  const { from, to } = lowerPathEndpoint(segment, item, name, state, ctx);
  const radius = segment.radius
    ? evalNum(segment.radius, ctx)
    : Math.hypot(to[0] - from.point[0], to[1] - from.point[1]) / 2;
  validateArcRadius(name, from.point, to, radius, item.span, ctx);
  registerPathEndpoint(state, name, from, to);
  return {
    kind: 'arc',
    name,
    from: from.point,
    to,
    radius,
    clockwise: segment.direction === 'cw',
    construction: item.construction,
  };
}

/**
 * Handles lower path endpoint in the sketch flow.
 */
function lowerPathEndpoint(
  segment: Extract<PathSegmentItem['segment'], { kind: 'line' | 'arc' }>,
  item: PathSegmentItem,
  name: string,
  state: PathEvalState,
  ctx: EvalCtx,
): { from: { name: string; point: [number, number] }; to: [number, number] } {
  resetPathStartAfterClosedLoop(segment.form, state);
  return {
    from: pathStartPoint(
      name,
      segment.form,
      segment.start,
      state,
      item.span,
      ctx,
    ),
    to: evalPoint(segment.end, ctx),
  };
}

/**
 * Handles register path endpoint in the sketch flow.
 */
function registerPathEndpoint(
  state: PathEvalState,
  name: string,
  from: { name: string; point: [number, number] },
  to: [number, number],
): void {
  const toName = `${name}.end`;
  addPathPoint(state, `${name}.start`, from.name, from.point);
  addPathPoint(state, toName, toName, to);
  if (!state.start) {
    state.start = from.point;
    state.startName = from.name;
  }
  state.cursor = to;
  state.cursorName = toName;
  state.loopClosed = false;
}

/**
 * Handles lower path close in the sketch flow.
 */
function lowerPathClose(
  item: PathSegmentItem,
  name: string,
  state: PathEvalState,
  ctx: EvalCtx,
): IRProfileSegment | null {
  if (!state.start || !state.cursor) {
    addError(
      ctx,
      'close() requires an established path start point.',
      item.span,
    );
    return null;
  }
  const from = state.cursor;
  const to = state.start;
  addPathPoint(
    state,
    `${name}.start`,
    state.cursorName ?? `${name}.start`,
    from,
  );
  addPathPoint(state, `${name}.end`, state.startName ?? `${name}.end`, to);
  state.cursor = to;
  state.cursorName = state.startName;
  state.loopClosed = true;
  return {
    kind: 'line',
    name,
    from,
    to,
    plant: item.plant,
    construction: item.construction,
  };
}

/**
 * Resets path start after closed loop to its initial state.
 */
function resetPathStartAfterClosedLoop(
  form: 'explicit' | 'inferred',
  state: PathEvalState,
): void {
  if (form !== 'explicit' || !state.loopClosed) return;
  state.start = null;
  state.startName = null;
  state.cursor = null;
  state.cursorName = null;
  state.loopClosed = false;
}

/**
 * Builds the path data required by the current operation.
 */
function pathStartPoint(
  name: string,
  form: 'explicit' | 'inferred',
  start: [import('@bushscad/ir').Expr, import('@bushscad/ir').Expr] | undefined,
  state: PathEvalState,
  span: ASTSourceSpan,
  ctx: EvalCtx,
): { name: string; point: [number, number] } {
  if (form === 'explicit')
    return { name: `${name}.start`, point: evalPoint(start!, ctx) };
  if (state.cursor && state.cursorName)
    return { name: state.cursorName, point: state.cursor };
  addError(ctx, 'Path segment requires an established cursor.', span);
  return { name: `${name}.start`, point: [0, 0] };
}

/**
 * Adds path point to its owning collection.
 */
function addPathPoint(
  state: PathEvalState,
  alias: string,
  name: string,
  point: [number, number],
): void {
  state.aliases.set(alias, name);
  if (!state.points.has(name)) state.points.set(name, point);
}

/**
 * Evaluates point with the current evaluation context.
 */
function evalPoint(
  point: [import('@bushscad/ir').Expr, import('@bushscad/ir').Expr],
  ctx: EvalCtx,
): [number, number] {
  return [evalNum(point[0], ctx), evalNum(point[1], ctx)];
}
