/**
 * @author Aidan Boissonneault
 * @file eval-path-body-expressions.ts
 * @purpose Evaluates path body expressions for the sketch in evaluator package.
 * @last-edited October 6, 2026
 */

import type {
  IRAtomicRegion,
  IRClosedBody,
  IRProfileBodySelection,
  IRProfileLoop,
  PathBodyExpression,
  PathBodyExpressionDecl,
  PathIgnoredBodyExpressionDecl,
} from '@bushscad/ir';
import type { EvalCtx } from '../core/eval-types.js';
import { addError } from '../core/eval-context.js';

/**
 * State for path body expression, including loops, regions, bodies, selections, and invalid
 * selections.
 */
export type PathBodyExpressionState = {
  loops: IRProfileLoop[];
  regions: IRAtomicRegion[];
  bodies: IRClosedBody[];
  selections: IRProfileBodySelection[];
  invalidSelections: Set<string>;
};

/**
 * Selected body ids, including ids and valid.
 */
type SelectedBodyIds = { ids: Set<string>; valid: boolean };

/**
 * Evaluates one named body expression against the sketch's atomic regions.
 * Source expressions describe set algebra over loops and prior aliases, while
 * downstream geometry consumes stable atomic body ids. Lowering the algebra
 * once here keeps the OCCT bridge independent from source-level names.
 */
export function evalPathBodyExpressionDeclaration(
  declaration: PathBodyExpressionDecl,
  state: PathBodyExpressionState,
  ctx: EvalCtx,
): void {
  const result = evalBodyExpression(declaration.expression, state, ctx);
  if (result.valid && result.ids.size === 0) {
    addError(
      ctx,
      `Path body expression '${declaration.name}' selects no closed bodies`,
      declaration.span,
    );
  }
  if (!result.valid) state.invalidSelections.add(declaration.name);
  state.selections.push({
    name: declaration.name,
    bodyIds: orderedBodyIds(result.ids, state.bodies),
  });
}

/** Marks every atomic body selected by an `ignore(...)` expression. */
export function evalIgnoredPathBodyExpression(
  declaration: PathIgnoredBodyExpressionDecl,
  state: PathBodyExpressionState,
  ctx: EvalCtx,
): void {
  const result = evalBodyExpression(declaration.expression, state, ctx);
  if (result.valid && result.ids.size === 0) {
    addError(
      ctx,
      'Ignored path body expression selects no closed bodies',
      declaration.span,
    );
  }
  for (const body of state.bodies) {
    if (result.ids.has(body.id)) body.ignored = true;
  }
}

/**
 * Evaluates body expression with the current evaluation context.
 */
function evalBodyExpression(
  expression: PathBodyExpression,
  state: PathBodyExpressionState,
  ctx: EvalCtx,
): SelectedBodyIds {
  if (expression.kind === 'pathBodyBoolean') {
    const left = evalBodyExpression(expression.left, state, ctx);
    const right = evalBodyExpression(expression.right, state, ctx);
    return {
      ids: combineBodyIds(expression.op, left.ids, right.ids),
      valid: left.valid && right.valid,
    };
  }
  if (expression.kind === 'pathBodyLoop') {
    return bodyIdsForFeature(
      expression.featureName,
      expression.span,
      state,
      ctx,
    );
  }
  const alias = [...state.selections]
    .reverse()
    .find((selection) => selection.name === expression.name);
  return alias
    ? {
        ids: new Set(alias.bodyIds),
        valid: !state.invalidSelections.has(alias.name),
      }
    : bodyIdsForFeature(expression.name, expression.span, state, ctx);
}

/**
 * Builds the body data required by the current operation.
 */
function bodyIdsForFeature(
  featureName: string,
  span: PathBodyExpression['span'],
  state: PathBodyExpressionState,
  ctx: EvalCtx,
): SelectedBodyIds {
  const loops = state.loops.filter((loop) =>
    loop.segmentNames.includes(featureName),
  );
  if (loops.length !== 1) {
    const message =
      loops.length === 0
        ? `Path feature '${featureName}' is not part of a closed loop`
        : `Path feature '${featureName}' belongs to multiple closed loops`;
    addError(ctx, message, span);
    return { ids: new Set(), valid: false };
  }
  const loopId = loops[0].id;
  return {
    ids: new Set(
      state.regions
        .filter((region) => region.includeLoopIds.includes(loopId))
        .map((region) => region.id),
    ),
    valid: true,
  };
}

/**
 * Handles combine body ids in the sketch flow.
 */
function combineBodyIds(
  op: Extract<PathBodyExpression, { kind: 'pathBodyBoolean' }>['op'],
  left: ReadonlySet<string>,
  right: ReadonlySet<string>,
): Set<string> {
  if (op === 'union') return new Set([...left, ...right]);
  if (op === 'intersect') {
    return new Set([...left].filter((id) => right.has(id)));
  }
  return new Set([...left].filter((id) => !right.has(id)));
}

/**
 * Handles ordered body ids in the sketch flow.
 */
function orderedBodyIds(
  selected: ReadonlySet<string>,
  bodies: IRClosedBody[],
): string[] {
  return bodies.filter((body) => selected.has(body.id)).map((body) => body.id);
}
