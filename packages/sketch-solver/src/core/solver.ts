/**
 * @author Aidan Boissonneault
 * @file solver.ts
 * @purpose Provides solver behavior for the core in sketch solver package.
 * @last-edited October 6, 2026
 */

import { buildConstraintEquations } from '../constraints/constraint-equations.js';
import type {
  SolveInput,
  SolveResult,
  SolverConstraint,
  SolverSegment,
} from '../types/types.js';
import {
  leastSquaresStep,
  matrixRank,
  nullspaceColumns,
  numericalJacobian,
  type Matrix,
  type Vector,
} from './solver-linear-algebra.js';

const CONVERGE_EPS = 1e-9;
const DIFF_EPS = 1e-6;
const MAX_ITER = 150;
const DAMPING = 0.5;

/**
 * Solves a sketch constraint system using damped Newton iteration.
 *
 * Sketches may be underconstrained while still producing useful geometry, so
 * the result includes rank-derived freedom and the best available geometry.
 */
export function solve(input: SolveInput): SolveResult {
  const state = initializeSolveState(input);
  /**
   * Handles equations in the core flow.
   */
  const equations = (variables: Vector) =>
    buildConstraintEquations(
      input.constraints,
      state.segments,
      variables,
      state.variableIndex,
      state.fixedPoints,
      input.dimensions,
    );
  const solved = iterate(
    equations,
    state.initialVariables,
    state.variableCount,
  );
  const geometry = solvedGeometry(input, state, solved.variables);
  const finalValues = equations(solved.variables);
  const finalJacobian = numericalJacobian(
    equations,
    solved.variables,
    finalValues,
    state.variableCount,
    DIFF_EPS,
  );
  const rank = matrixRank(finalJacobian);

  if (
    !solved.converged &&
    (!Number.isFinite(solved.residual) || solved.residual >= CONVERGE_EPS * 100)
  ) {
    const conflicting = conflictingConstraintIds(
      input,
      state,
      solved.variables,
    );
    if (hasInvalidResidual(finalValues) || finalValues.length > rank) {
      return {
        ok: false,
        kind: 'overconstrained',
        conflicting,
        invalidExpressions: hasInvalidResidual(finalValues)
          ? conflicting
          : undefined,
      };
    }
    return {
      ok: false,
      kind: 'no-convergence',
      residual: solved.residual,
      ...geometry,
    };
  }

  const dof = Math.max(0, state.variableCount - rank);
  if (dof > 0) {
    return {
      ok: false,
      kind: 'underconstrained',
      dof,
      freeNames: freeVariableNames(state, finalJacobian),
      ...geometry,
    };
  }
  return { ok: true, ...geometry };
}

/**
 * State for solve, including variable index, fixed points, variable labels, initial variables,
 * and variable count.
 */
type SolveState = {
  variableIndex: Map<string, number>;
  fixedPoints: Map<string, [number, number]>;
  variableLabels: string[];
  initialVariables: Vector;
  variableCount: number;
  segments: Map<string, SolverSegment>;
};

/**
 * Handles initialize solve state in the core flow.
 */
function initializeSolveState(input: SolveInput): SolveState {
  const variableIndex = new Map<string, number>();
  const fixedPoints = new Map<string, [number, number]>([['origin', [0, 0]]]);
  const variableLabels: string[] = [];
  const initialVariables: number[] = [];
  const fixedTargets = new Set(
    input.constraints
      .filter((item) => item.kind === 'fixed')
      .map((item) => item.target),
  );
  const fixedSegments = new Set(
    input.segments
      .filter((segment) => segment.fixed || fixedTargets.has(segment.name))
      .map((segment) => segment.name),
  );
  const fixedNames = fixedPointNames(input, fixedTargets, fixedSegments);
  for (const point of input.points) {
    if (point.fixed || fixedNames.has(point.name)) {
      fixedPoints.set(point.name, [point.x, point.y]);
      continue;
    }
    addVariable(
      variableIndex,
      variableLabels,
      initialVariables,
      `${point.name}_x`,
      point.x,
    );
    addVariable(
      variableIndex,
      variableLabels,
      initialVariables,
      `${point.name}_y`,
      point.y,
    );
  }
  for (const segment of input.segments) {
    if (segment.kind === 'arc' && !fixedSegments.has(segment.name)) {
      addVariable(
        variableIndex,
        variableLabels,
        initialVariables,
        `${segment.name}_radius`,
        segment.radius,
      );
    }
  }
  return {
    variableIndex,
    fixedPoints,
    variableLabels,
    initialVariables,
    variableCount: initialVariables.length,
    segments: new Map(input.segments.map((segment) => [segment.name, segment])),
  };
}

/**
 * Handles fixed point names in the core flow.
 */
function fixedPointNames(
  input: SolveInput,
  fixedTargets: Set<string>,
  fixedSegments: Set<string>,
): Set<string> {
  const names = new Set(
    input.points
      .filter((point) => fixedTargets.has(point.name))
      .map((point) => point.name),
  );
  for (const segment of input.segments) {
    if (!fixedSegments.has(segment.name)) continue;
    if (segment.from.kind === 'point') names.add(segment.from.name);
    if (segment.to.kind === 'point') names.add(segment.to.name);
  }
  return names;
}

/**
 * Adds variable to its owning collection.
 */
function addVariable(
  index: Map<string, number>,
  labels: string[],
  values: number[],
  name: string,
  value: number,
): void {
  index.set(name, values.length);
  labels.push(name);
  values.push(value);
}

/**
 * Handles iterate in the core flow.
 */
function iterate(
  equations: (variables: Vector) => Vector,
  initial: Vector,
  variableCount: number,
): { variables: Vector; residual: number; converged: boolean } {
  const variables = [...initial];
  let residual = Number.POSITIVE_INFINITY;
  let converged = false;
  for (let iteration = 0; iteration < MAX_ITER; iteration++) {
    const values = equations(variables);
    residual = vectorNorm(values);
    if (residual < CONVERGE_EPS || values.length === 0) {
      converged = true;
      break;
    }
    if (!Number.isFinite(residual) || variableCount === 0) break;
    const delta = leastSquaresStep(
      numericalJacobian(equations, variables, values, variableCount, DIFF_EPS),
      values,
    );
    if (!delta) break;
    for (let index = 0; index < variableCount; index++) {
      variables[index] += DAMPING * delta[index];
    }
  }
  return { variables, residual, converged };
}

/**
 * Handles solved geometry in the core flow.
 */
function solvedGeometry(
  input: SolveInput,
  state: SolveState,
  variables: Vector,
): { points: Map<string, [number, number]>; radii: Map<string, number> } {
  const points = new Map<string, [number, number]>();
  for (const point of input.points) {
    const fixed = state.fixedPoints.get(point.name);
    const index = state.variableIndex.get(`${point.name}_x`);
    points.set(point.name, fixed ?? [variables[index!], variables[index! + 1]]);
  }
  const radii = new Map<string, number>();
  for (const segment of input.segments) {
    if (segment.kind !== 'arc') continue;
    const index = state.variableIndex.get(`${segment.name}_radius`);
    radii.set(
      segment.name,
      index === undefined ? segment.radius : variables[index],
    );
  }
  return { points, radii };
}

/**
 * Handles free variable names in the core flow.
 */
function freeVariableNames(state: SolveState, jacobian: Matrix): string[] {
  const columns = nullspaceColumns(jacobian, state.variableCount);
  return [
    ...new Set(
      [...columns].map((index) =>
        state.variableLabels[index]
          .replace(/_(x|y)$/, '')
          .replace(/_radius$/, '.radius'),
      ),
    ),
  ];
}

/**
 * Handles conflicting constraint ids in the core flow.
 */
function conflictingConstraintIds(
  input: SolveInput,
  state: SolveState,
  variables: Vector,
): string[] {
  const scored = input.constraints
    .map((constraint) => ({
      constraint,
      residual: vectorNorm(
        buildConstraintEquations(
          [constraint],
          state.segments,
          variables,
          state.variableIndex,
          state.fixedPoints,
          input.dimensions,
        ),
      ),
    }))
    .filter(
      (item) =>
        !Number.isFinite(item.residual) || item.residual > CONVERGE_EPS * 100,
    )
    .sort((left, right) => right.residual - left.residual);
  const candidates =
    scored.length > 0
      ? scored
      : input.constraints.map((constraint) => ({ constraint }));
  return candidates.map(({ constraint }) => constraintIdentity(constraint));
}

/**
 * Handles constraint identity in the core flow.
 */
function constraintIdentity(constraint: SolverConstraint): string {
  return (
    constraint.id ??
    `${constraint.kind}@${constraint.spanLine}:${constraint.spanCol}`
  );
}

/**
 * Checks whether the input has invalid residual.
 */
function hasInvalidResidual(values: Vector): boolean {
  return values.some((value) => !Number.isFinite(value));
}

/**
 * Handles vector norm in the core flow.
 */
function vectorNorm(vector: Vector): number {
  return Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
}
