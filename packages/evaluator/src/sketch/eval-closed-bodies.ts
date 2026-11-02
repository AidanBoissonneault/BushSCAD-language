/**
 * @author Aidan Boissonneault
 * @file eval-closed-bodies.ts
 * @purpose Evaluates closed bodies for the sketch in evaluator package.
 * @last-edited October 6, 2026
 */

import type {
  ASTSourceSpan,
  IRClosedBody,
  IRProfileBodySelection,
  IRProfileSegment,
  PathBodyExpressionDecl,
  PathClosedBodyDecl,
  PathIgnoredBodyExpressionDecl,
  PathIgnoredClosedBodyDecl,
} from '@bushscad/ir';
import {
  detectAtomicRegions,
  detectProfileLoops,
  selectAtomicRegionContainingPoint,
} from '@bushscad/ir';
import type { EvalCtx } from '../core/eval-types.js';
import { addError } from '../core/eval-context.js';
import { evalNum } from '../expressions/eval-expressions.js';
import {
  evalIgnoredPathBodyExpression,
  evalPathBodyExpressionDeclaration,
  type PathBodyExpressionState,
} from './eval-path-body-expressions.js';

/**
 * Evaluated closed bodies, including closed bodies and body selections.
 */
export type EvaluatedClosedBodies = {
  closedBodies?: IRClosedBody[];
  bodySelections?: IRProfileBodySelection[];
};

/**
 * Body declaration is tagged by kind: 'point', 'expression', and 'ignoredExpression'.
 */
type BodyDeclaration =
  | { kind: 'point'; declaration: PathClosedBodyDecl }
  | { kind: 'expression'; declaration: PathBodyExpressionDecl }
  | {
      kind: 'ignoredExpression';
      declaration: PathIgnoredBodyExpressionDecl;
    };

/**
 * Resolves path-local body declarations against solved profile regions.
 * Feature expressions need set algebra over atomic regions, while legacy
 * `closed(x, y)` declarations still need point containment. Evaluating both
 * in source order gives later aliases one consistent namespace.
 */
export function evalClosedBodies(
  segments: IRProfileSegment[],
  named: PathClosedBodyDecl[],
  ignored: PathIgnoredClosedBodyDecl[],
  expressions: PathBodyExpressionDecl[],
  ignoredExpressions: PathIgnoredBodyExpressionDecl[],
  ctx: EvalCtx,
): EvaluatedClosedBodies {
  const loops = detectProfileLoops(segments);
  const regions = detectAtomicRegions(loops);
  const bodies = regions.map(
    (region): IRClosedBody => ({
      id: region.id,
      loopIds: region.includeLoopIds,
      excludedLoopIds: region.excludedLoopIds,
      segmentNames: segmentNamesForLoops(loops, region.includeLoopIds),
    }),
  );
  const selections: IRProfileBodySelection[] = [];
  const expressionState: PathBodyExpressionState = {
    loops,
    regions,
    bodies,
    selections,
    invalidSelections: new Set(),
  };
  for (const item of orderedBodyDeclarations(
    named,
    expressions,
    ignoredExpressions,
  )) {
    if (item.kind === 'expression') {
      evalPathBodyExpressionDeclaration(item.declaration, expressionState, ctx);
    } else if (item.kind === 'ignoredExpression') {
      evalIgnoredPathBodyExpression(item.declaration, expressionState, ctx);
    } else if (loops.length > 0) {
      evalNamedPointBody(item.declaration, expressionState, ctx);
    }
  }
  if (loops.length > 0) {
    for (const decl of ignored) {
      const point = evalPoint(decl.point, ctx);
      const body = bodyForPoint(
        bodies,
        loops,
        regions,
        point,
        decl.span,
        ctx,
        true,
      );
      if (body) {
        body.ignored = true;
        body.containsPoint = point;
      }
    }
  }
  return {
    closedBodies: bodies.length > 0 ? bodies : undefined,
    bodySelections: selections.length > 0 ? selections : undefined,
  };
}

/**
 * Evaluates named point body with the current evaluation context.
 */
function evalNamedPointBody(
  declaration: PathClosedBodyDecl,
  state: PathBodyExpressionState,
  ctx: EvalCtx,
): void {
  const point = evalPoint(declaration.point, ctx);
  const body = bodyForPoint(
    state.bodies,
    state.loops,
    state.regions,
    point,
    declaration.span,
    ctx,
    false,
  );
  if (!body) return;
  body.name = declaration.name;
  body.containsPoint = point;
  state.selections.push({ name: declaration.name, bodyIds: [body.id] });
}

/**
 * Handles ordered body declarations in the sketch flow.
 */
function orderedBodyDeclarations(
  points: PathClosedBodyDecl[],
  expressions: PathBodyExpressionDecl[],
  ignoredExpressions: PathIgnoredBodyExpressionDecl[],
): BodyDeclaration[] {
  return [
    ...points.map(
      (declaration): BodyDeclaration => ({
        kind: 'point',
        declaration,
      }),
    ),
    ...expressions.map(
      (declaration): BodyDeclaration => ({
        kind: 'expression',
        declaration,
      }),
    ),
    ...ignoredExpressions.map(
      (declaration): BodyDeclaration => ({
        kind: 'ignoredExpression',
        declaration,
      }),
    ),
  ].sort(
    (a, b) =>
      a.declaration.span.line - b.declaration.span.line ||
      a.declaration.span.col - b.declaration.span.col,
  );
}

/**
 * Builds the body data required by the current operation.
 */
function bodyForPoint(
  bodies: IRClosedBody[],
  loops: ReturnType<typeof detectProfileLoops>,
  regions: ReturnType<typeof detectAtomicRegions>,
  point: [number, number],
  span: ASTSourceSpan,
  ctx: EvalCtx,
  preferAdjacentRegion: boolean,
): IRClosedBody | null {
  const region = selectAtomicRegionContainingPoint(loops, regions, point);
  if (!region) {
    addError(
      ctx,
      `closed body point (${point[0]}, ${point[1]}) is not inside a closed body`,
      span,
    );
    return null;
  }
  const syntheticBody = preferAdjacentRegion
    ? bodyWithoutEnclosingLoop(bodies, region, loops)
    : null;
  if (syntheticBody) return syntheticBody;
  const selected = region;
  return bodies.find((body) => body.id === selected.id) ?? null;
}

/**
 * Builds the body data required by the current operation.
 */
function bodyWithoutEnclosingLoop(
  bodies: IRClosedBody[],
  region: ReturnType<typeof detectAtomicRegions>[number],
  loops: ReturnType<typeof detectProfileLoops>,
): IRClosedBody | null {
  if (region.includeLoopIds.length < 3) return null;
  const enclosingLoop = region.includeLoopIds
    .map((id) => loops.find((loop) => loop.id === id))
    .filter((loop): loop is ReturnType<typeof detectProfileLoops>[number] =>
      Boolean(loop),
    )
    .sort((a, b) => Math.abs(b.area) - Math.abs(a.area))[0];
  if (!enclosingLoop) return null;
  const loopIds = region.includeLoopIds.filter((id) => id !== enclosingLoop.id);
  const existing = bodies.find((body) => sameIds(body.loopIds ?? [], loopIds));
  if (existing) return existing.ignored ? null : existing;
  const body: IRClosedBody = {
    id: `body_${bodies.length + 1}`,
    loopIds,
    excludedLoopIds: loops
      .map((loop) => loop.id)
      .filter((id) => !loopIds.includes(id)),
    segmentNames: segmentNamesForLoops(loops, loopIds),
  };
  bodies.push(body);
  return body;
}

/**
 * Checks whether the supplied ids values are equivalent.
 */
function sameIds(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((id, index) => id === b[index]);
}

/**
 * Creates a segment from its endpoint coordinates.
 */
function segmentNamesForLoops(
  loops: ReturnType<typeof detectProfileLoops>,
  loopIds: string[],
): string[] {
  const names = loops
    .filter((loop) => loopIds.includes(loop.id))
    .flatMap((loop) => loop.segmentNames);
  return [...new Set(names)];
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
