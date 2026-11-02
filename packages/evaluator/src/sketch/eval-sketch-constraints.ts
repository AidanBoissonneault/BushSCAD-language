/**
 * @author Aidan Boissonneault
 * @file eval-sketch-constraints.ts
 * @purpose Evaluates sketch constraints for the sketch in evaluator package.
 * @last-edited October 6, 2026
 */

import type {
  ASTSourceSpan,
  ConstraintDecl,
  IRConstraintState,
  SketchDimensionDecl,
} from '@bushscad/ir';
import { solve } from '@bushscad/sketch-solver';
import type {
  SolveInput,
  SolverConstraint,
  SolverPoint,
  SolverSegment,
} from '@bushscad/sketch-solver';
import type { EvalCtx } from '../core/eval-types.js';
import { addError } from '../core/eval-context.js';
import {
  buildSolverDimensions,
  evalSketchScalarExpression,
} from './eval-sketch-scalar-expressions.js';

/**
 * Sketch constraint solve, including point geometry, radii, and constraint state.
 */
export type SketchConstraintSolve = {
  points: Map<string, [number, number]> | null;
  radii: Map<string, number> | null;
  constraintState?: IRConstraintState;
};

/**
 * Solves named sketch points against parsed path constraint declarations.
 */
export function solveSketchConstraints(
  points: SolverPoint[],
  segments: SolverSegment[],
  constraints: ConstraintDecl[],
  dimensions: SketchDimensionDecl[],
  span: ASTSourceSpan,
  ctx: EvalCtx,
  aliases = new Map<string, string>(),
): SketchConstraintSolve {
  if (points.length === 0 && constraints.length === 0) {
    return { points: null, radii: null };
  }
  const initialPoints = initialPointMap(points, aliases);
  const solverDimensions = buildSolverDimensions(
    constraints,
    dimensions,
    aliases,
  );
  const dimensionNames = new Set(solverDimensions.map((item) => item.name));
  const solverConstraints = constraints.map((constraint) =>
    evalConstraint(constraint, ctx, aliases, initialPoints, dimensionNames),
  );
  const result = solve({
    points,
    segments,
    constraints: solverConstraints,
    dimensions: solverDimensions,
  } satisfies SolveInput);

  if (result.ok)
    return {
      points: result.points,
      radii: result.radii,
      constraintState: { status: 'fully-constrained' },
    };

  if (result.kind === 'underconstrained') {
    return {
      points: result.points,
      radii: result.radii,
      constraintState: {
        status: 'underconstrained',
        dof: result.dof,
        freeNames: result.freeNames,
      },
    };
  }

  if (result.kind === 'overconstrained') {
    if (result.invalidExpressions?.length) {
      reportInvalidDimensionExpressions(
        constraints,
        result.invalidExpressions,
        ctx,
      );
      return { points: null, radii: null };
    }
    addError(
      ctx,
      `Sketch constraints are overconstrained (${result.conflicting.join(', ')})`,
      span,
    );
    return { points: null, radii: null };
  }

  addError(
    ctx,
    `Sketch constraint solver did not converge (residual ${result.residual.toExponential(2)}). Check for conflicting constraints.`,
    span,
  );
  return {
    points: result.points,
    radii: result.radii,
    constraintState: { status: 'no-convergence', residual: result.residual },
  };
}

/**
 * Handles report invalid dimension expressions in the sketch flow.
 */
function reportInvalidDimensionExpressions(
  constraints: ConstraintDecl[],
  invalidIds: string[],
  ctx: EvalCtx,
): void {
  const invalid = new Set(invalidIds);
  for (const constraint of constraints) {
    const id =
      constraint.name ??
      `${constraint.constraint}@${constraint.span.line}:${constraint.span.col}`;
    if (!invalid.has(id) || !constraint.value) continue;
    addError(
      ctx,
      'Sketch dimension expression evaluated to a non-finite value (division by zero or invalid measurement)',
      constraint.value.span,
    );
  }
}

/**
 * Evaluates constraint with the current evaluation context.
 */
function evalConstraint(
  constraint: ConstraintDecl,
  ctx: EvalCtx,
  aliases: Map<string, string>,
  initialPoints: Map<string, [number, number]>,
  dimensionNames: Set<string>,
): SolverConstraint {
  const target = resolveConstraintName(constraint.target, aliases);
  const ref =
    constraint.ref === undefined
      ? undefined
      : resolveConstraintName(constraint.ref, aliases);
  return {
    id:
      constraint.name ??
      `${constraint.constraint}@${constraint.span.line}:${constraint.span.col}`,
    kind: constraint.constraint,
    target,
    ref,
    axis: constraint.axis,
    value:
      constraint.value !== undefined
        ? evalSketchScalarExpression(constraint.value, dimensionNames, ctx)
        : undefined,
    axisSign: axisSignForDistance(
      constraint.axis,
      ref,
      initialPoints.get(target),
      ref ? initialPoints.get(ref) : undefined,
    ),
    spanLine: constraint.span.line,
    spanCol: constraint.span.col,
  };
}

/**
 * Handles initial point map in the sketch flow.
 */
function initialPointMap(
  points: SolverPoint[],
  aliases: Map<string, string>,
): Map<string, [number, number]> {
  const map = new Map(
    points.map((point) => [point.name, [point.x, point.y] as [number, number]]),
  );
  for (const [alias, name] of aliases) {
    const point = map.get(name);
    if (point) map.set(alias, point);
  }
  map.set('origin', [0, 0]);
  return map;
}

/**
 * Builds the axis data required by the current operation.
 */
function axisSignForDistance(
  axis: ConstraintDecl['axis'],
  ref: string | undefined,
  point: [number, number] | undefined,
  reference: [number, number] | undefined,
): 1 | -1 | undefined {
  if (!point) return undefined;
  const originCoordinate = originAxisCoordinate(ref, point);
  if (originCoordinate !== undefined) return signFor(originCoordinate);
  return axis && reference
    ? signFor(coordinate(point, axis) - coordinate(reference, axis))
    : undefined;
}

/**
 * Handles coordinate in the sketch flow.
 */
function coordinate(point: [number, number], axis: 'x' | 'y'): number {
  return axis === 'x' ? point[0] : point[1];
}

/**
 * Handles origin axis coordinate in the sketch flow.
 */
function originAxisCoordinate(
  ref: string | undefined,
  point: [number, number],
): number | undefined {
  if (ref === 'origin.x_axis') return point[1];
  if (ref === 'origin.y_axis') return point[0];
  return undefined;
}

/**
 * Handles sign for in the sketch flow.
 */
function signFor(value: number): 1 | -1 {
  return value < 0 ? -1 : 1;
}

/**
 * Resolves constraint name using the sketch rules.
 */
function resolveConstraintName(
  name: string,
  aliases: Map<string, string>,
): string {
  return aliases.get(name) ?? name;
}
