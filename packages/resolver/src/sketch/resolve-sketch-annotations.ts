/**
 * @author Aidan Boissonneault
 * @file resolve-sketch-annotations.ts
 * @purpose Resolves sketch annotations for the sketch in resolver package.
 * @last-edited October 6, 2026
 */

import type { ConstraintDecl, Expr, SketchDimensionDecl } from '@bushscad/ir';
import { Scope } from '../core/scope.js';
import type { State } from '../core/types.js';
import { addError } from '../core/errors.js';
import { resolveExpr } from '../references/expressions.js';
import { isKnownSketchName } from './sketch-references.js';
import { resolveSketchPoint } from './resolve-points.js';

/**
 * Input for sketch annotation, including constraints, dimensions, segment names, point names,
 * and container.
 */
type SketchAnnotationInput = {
  constraints: ConstraintDecl[];
  dimensions: SketchDimensionDecl[];
  segmentNames: Set<string>;
  pointNames: Set<string>;
  container: 'path';
};

/**
 * Resolves sketch annotations and their order-independent local scalar names.
 * Driving expressions may use any named dimension in the same sketch. They
 * therefore need a local scope collected before expressions are resolved,
 * rather than declaration-order mutation of the enclosing model scope.
 */
export function resolveSketchAnnotations(
  input: SketchAnnotationInput,
  scope: Scope,
  state: State,
): void {
  const allNames = new Set([...input.segmentNames, ...input.pointNames]);
  const local = new Scope(scope);
  const dimensionNames = collectDimensionNames(input, scope, state);
  for (const name of dimensionNames) local.define(name, 'binding');

  for (const constraint of input.constraints) {
    validateTarget(
      constraint.target,
      allNames,
      'Constraint target',
      constraint.span,
      input.container,
      state,
    );
    if (constraint.ref) {
      validateTarget(
        constraint.ref,
        allNames,
        'Constraint reference',
        constraint.span,
        input.container,
        state,
      );
    }
    validateMidpoint(constraint, input, state);
    validateAxisAlignment(constraint, input, state);
    if (constraint.value) resolveExpr(constraint.value, local, state);
    if (constraint.label) resolveSketchPoint(constraint.label, scope, state);
  }
  for (const dimension of input.dimensions) {
    validateTarget(
      dimension.target,
      allNames,
      'Dimension target',
      dimension.span,
      input.container,
      state,
    );
    if (dimension.ref) {
      validateTarget(
        dimension.ref,
        allNames,
        'Dimension reference',
        dimension.span,
        input.container,
        state,
      );
    }
    resolveSketchPoint(dimension.label, scope, state);
  }
  reportDimensionCycles(input.constraints, dimensionNames, state);
}

/**
 * Validates the two supported horizontal/vertical forms.
 * A unary constraint orients a segment, while the optional-reference form
 * aligns two points on one Cartesian axis. Keeping their roles explicit avoids
 * silently treating a point name as a missing segment in the solver.
 */
function validateAxisAlignment(
  constraint: ConstraintDecl,
  input: SketchAnnotationInput,
  state: State,
): void {
  if (
    constraint.constraint !== 'horizontal' &&
    constraint.constraint !== 'vertical'
  ) {
    return;
  }
  if (!constraint.ref) {
    if (!input.segmentNames.has(constraint.target)) {
      addError(
        state,
        `${axisConstraintLabel(constraint)} constraint target must be a segment when no reference is provided`,
        constraint.span,
      );
    }
    return;
  }
  if (!isSketchPoint(constraint.target, input.pointNames)) {
    addError(
      state,
      `${axisConstraintLabel(constraint)} point-pair target must be a named point or segment endpoint`,
      constraint.span,
    );
  }
  if (!isSketchPoint(constraint.ref, input.pointNames)) {
    addError(
      state,
      `${axisConstraintLabel(constraint)} point-pair reference must be a named point or segment endpoint`,
      constraint.span,
    );
  }
}

/**
 * Builds the axis data required by the current operation.
 */
function axisConstraintLabel(constraint: ConstraintDecl): string {
  return constraint.constraint === 'horizontal' ? 'Horizontal' : 'Vertical';
}

/**
 * Returns whether the input meets the `sketch point` condition.
 */
function isSketchPoint(name: string, pointNames: Set<string>): boolean {
  return name === 'origin' || pointNames.has(name);
}

/**
 * Collects dimension names from the supplied values.
 */
function collectDimensionNames(
  input: SketchAnnotationInput,
  scope: Scope,
  state: State,
): Set<string> {
  const names = new Set<string>();
  for (const annotation of [...input.constraints, ...input.dimensions]) {
    if (!annotation.name) continue;
    if (annotation.kind === 'constraint' && !isDimensional(annotation)) {
      addError(
        state,
        'Only dimensional constraints can have a scalar name',
        annotation.span,
      );
      continue;
    }
    if (names.has(annotation.name)) {
      addError(
        state,
        `Duplicate sketch dimension name '${annotation.name}'`,
        annotation.span,
      );
      continue;
    }
    if (scope.lookup(annotation.name) !== null) {
      addError(
        state,
        `Sketch dimension name '${annotation.name}' conflicts with a visible binding`,
        annotation.span,
      );
      continue;
    }
    names.add(annotation.name);
  }
  return names;
}

/**
 * Validates target and reports any violations.
 */
function validateTarget(
  target: string,
  names: Set<string>,
  label: string,
  span: import('@bushscad/ir').ASTSourceSpan,
  container: SketchAnnotationInput['container'],
  state: State,
): void {
  if (!isKnownSketchName(target, names)) {
    addError(state, `${label} '${target}' not found in ${container}`, span);
  }
}

/**
 * Validates midpoint and reports any violations.
 */
function validateMidpoint(
  constraint: ConstraintDecl,
  input: SketchAnnotationInput,
  state: State,
): void {
  if (constraint.constraint !== 'midpoint') return;
  if (!input.pointNames.has(constraint.target)) {
    addError(
      state,
      'Midpoint constraint target must be a named point or segment endpoint',
      constraint.span,
    );
  }
  if (!constraint.ref || !input.segmentNames.has(constraint.ref)) {
    addError(
      state,
      'Midpoint constraint reference must be a segment',
      constraint.span,
    );
  }
}

/**
 * Returns whether the input meets the `dimensional` condition.
 */
function isDimensional(constraint: ConstraintDecl): boolean {
  return ['length', 'distance', 'angle', 'radius', 'diameter'].includes(
    constraint.constraint,
  );
}

/**
 * Handles report dimension cycles in the sketch flow.
 */
function reportDimensionCycles(
  constraints: ConstraintDecl[],
  names: Set<string>,
  state: State,
): void {
  const definitions = new Map(
    constraints
      .filter((item): item is ConstraintDecl & { name: string } =>
        Boolean(item.name),
      )
      .map((item) => [item.name, item]),
  );
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const reported = new Set<string>();
  /**
   * Handles visit in the sketch flow.
   */
  const visit = (name: string): void => {
    if (visited.has(name)) return;
    if (visiting.has(name)) {
      if (!reported.has(name)) {
        const definition = definitions.get(name);
        if (definition)
          addError(
            state,
            `Cyclic sketch dimension reference involving '${name}'`,
            definition.span,
          );
        reported.add(name);
      }
      return;
    }
    visiting.add(name);
    const value = definitions.get(name)?.value;
    if (value)
      for (const dependency of dimensionDependencies(value, names))
        visit(dependency);
    visiting.delete(name);
    visited.add(name);
  };
  for (const name of definitions.keys()) visit(name);
}

/**
 * Builds the dimension data required by the current drawing.
 */
function dimensionDependencies(expr: Expr, names: Set<string>): Set<string> {
  const found = new Set<string>();
  /**
   * Handles walk in the sketch flow.
   */
  const walk = (value: Expr): void => {
    if (value.kind === 'identifier') {
      if (names.has(value.name)) found.add(value.name);
      return;
    }
    expressionChildren(value).forEach(walk);
  };
  walk(expr);
  return found;
}

/**
 * Handles expression children in the sketch flow.
 */
function expressionChildren(expr: Expr): Expr[] {
  return [...operatorChildren(expr), ...collectionChildren(expr)];
}

/**
 * Handles operator children in the sketch flow.
 */
function operatorChildren(expr: Expr): Expr[] {
  if (expr.kind === 'binary') return [expr.left, expr.right];
  if (expr.kind === 'unary') return [expr.operand];
  if (expr.kind === 'ternary') return [expr.condition, expr.then, expr.else];
  if (expr.kind === 'unit') return [expr.value];
  return [];
}

/**
 * Handles collection children in the sketch flow.
 */
function collectionChildren(expr: Expr): Expr[] {
  if (expr.kind === 'template')
    return expr.parts.flatMap((part) =>
      part.kind === 'expression' ? [part.expression] : [],
    );
  if (expr.kind === 'tuple') return [expr.x, expr.y];
  if (expr.kind === 'list') return expr.items;
  if (expr.kind === 'call')
    return [...expr.args, ...expr.namedArgs.map((arg) => arg.value)];
  return [];
}
