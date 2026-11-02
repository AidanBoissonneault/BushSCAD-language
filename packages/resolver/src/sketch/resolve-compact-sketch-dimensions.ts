/**
 * @author Aidan Boissonneault
 * @file resolve-compact-sketch-dimensions.ts
 * @purpose Resolves compact sketch dimensions for the sketch in resolver package.
 * @last-edited October 6, 2026
 */

import type {
  CompactSketchDimensionDecl,
  CompactDimensionPrimitive,
  CompactSketchParameter,
  Expr,
  RectSide,
  SketchDecl,
} from '@bushscad/ir';
import {
  compactDimensionPrimitiveOwnsReference,
  compactDimensionPrimitives,
} from '@bushscad/ir';
import type { Scope } from '../core/scope.js';
import type { State } from '../core/types.js';
import { addError } from '../core/errors.js';
import { resolveExpr } from '../references/expressions.js';

/**
 * Binds compact `_` slots and resolves dimension assignment expressions.
 * `_` is deliberately not a general expression. Replacing it with the owned
 * assignment before normal primitive resolution keeps that restriction local
 * while still allowing pre-existing source expressions on the assignment RHS.
 */
export function resolveCompactSketchDimensions(
  sketch: SketchDecl,
  scope: Scope,
  state: State,
): void {
  for (const primitive of compactDimensionPrimitives(sketch.primitive)) {
    resolvePrimitiveDimensions(primitive, scope, state);
  }
}

/**
 * Resolves primitive dimensions against the current scope and reports unresolved references.
 */
function resolvePrimitiveDimensions(
  primitive: CompactDimensionPrimitive,
  scope: Scope,
  state: State,
): void {
  const bound = new Set<CompactSketchParameter>();
  for (const dimension of primitive.compactDimensions ?? []) {
    resolvePrimitiveDimension(primitive, dimension, bound, scope, state);
  }
  validateBoundPlaceholders(primitive, bound, state);
}

/**
 * Resolves primitive dimension against the current scope and reports unresolved references.
 */
function resolvePrimitiveDimension(
  primitive: CompactDimensionPrimitive,
  dimension: CompactSketchDimensionDecl,
  bound: Set<CompactSketchParameter>,
  scope: Scope,
  state: State,
): void {
  const parameter = dimensionParameter(primitive, dimension);
  validateDimensionTarget(primitive, dimension, state);
  if (dimension.offset) resolveExpr(dimension.offset, scope, state);
  if (!parameter || !primitive.dimensionPlaceholders?.[parameter]) {
    resolveExpr(dimension.value, scope, state);
    return;
  }
  if (bound.has(parameter)) {
    addError(
      state,
      `Compact primitive parameter '${parameter}' has more than one dimension assignment`,
      dimension.span,
    );
    return;
  }
  assignParameter(primitive, parameter, dimension.value);
  dimension.parameter = parameter;
  bound.add(parameter);
}

/**
 * Validates bound placeholders and reports any violations.
 */
function validateBoundPlaceholders(
  primitive: CompactDimensionPrimitive,
  bound: Set<CompactSketchParameter>,
  state: State,
): void {
  for (const parameter of placeholderParameters(primitive)) {
    if (!bound.has(parameter)) {
      addError(
        state,
        `Compact primitive '_' for '${parameter}' requires a following @ dimension assignment`,
        primitive.dimensionPlaceholders![parameter]!,
      );
    }
  }
}

/**
 * Builds the dimension data required by the current drawing.
 */
function dimensionParameter(
  primitive: CompactDimensionPrimitive,
  dimension: CompactSketchDimensionDecl,
): CompactSketchParameter | undefined {
  if (dimension.ref) return pairParameter(primitive, dimension);
  const direct = directDimensionParameter(primitive, dimension.target);
  if (direct) return direct;
  if (primitive.kind !== 'rect' && primitive.kind !== 'roundrect')
    return undefined;
  const side = rectangleSide(primitive, dimension.target);
  return side === 'bottom' || side === 'top'
    ? 'width'
    : side === 'left' || side === 'right'
      ? 'height'
      : undefined;
}

/**
 * Handles direct dimension parameter in the sketch flow.
 */
function directDimensionParameter(
  primitive: CompactDimensionPrimitive,
  target: string,
): CompactSketchParameter | undefined {
  if (primitive.kind === 'circle') {
    return target === 'diameter' ? 'diameter' : undefined;
  }
  if (primitive.kind === 'ellipse') {
    return target === 'width' || target === 'height' ? target : undefined;
  }
  return primitive.kind === 'roundrect' && target === 'radius'
    ? 'radius'
    : undefined;
}

/**
 * Handles pair parameter in the sketch flow.
 */
function pairParameter(
  primitive: CompactDimensionPrimitive,
  dimension: CompactSketchDimensionDecl,
): CompactSketchParameter | undefined {
  if (primitive.kind !== 'rect' && primitive.kind !== 'roundrect')
    return undefined;
  const first = rectangleSide(primitive, dimension.target);
  const second = rectangleSide(primitive, dimension.ref!);
  const pairs: Partial<Record<string, CompactSketchParameter>> = {
    'left:right': 'width',
    'right:left': 'width',
    'bottom:top': 'height',
    'top:bottom': 'height',
  };
  return pairs[`${first}:${second}`];
}

/**
 * Validates dimension target and reports any violations.
 */
function validateDimensionTarget(
  primitive: CompactDimensionPrimitive,
  dimension: CompactSketchDimensionDecl,
  state: State,
): void {
  for (const reference of [dimension.target, dimension.ref].filter(
    (item): item is string => Boolean(item),
  )) {
    if (reference === 'origin' || reference.startsWith('origin.')) continue;
    if (compactDimensionPrimitiveOwnsReference(primitive, reference)) continue;
    addError(
      state,
      `Unknown compact ${primitive.kind} dimension reference '${reference}'`,
      dimension.span,
    );
  }
}

/**
 * Creates rectangle geometry from the supplied dimensions.
 */
function rectangleSide(
  primitive: Exclude<CompactDimensionPrimitive, { kind: 'circle' | 'ellipse' }>,
  reference: string,
): RectSide | undefined {
  const sides: RectSide[] = ['bottom', 'right', 'top', 'left'];
  return sides.find(
    (side) =>
      reference === side ||
      (primitive.kind === 'rect' && primitive.sideNames?.[side] === reference),
  );
}

/**
 * Handles assign parameter in the sketch flow.
 */
function assignParameter(
  primitive: CompactDimensionPrimitive,
  parameter: CompactSketchParameter,
  value: Expr,
): void {
  if (parameter === 'diameter' && primitive.kind === 'circle')
    primitive.diameter = value;
  else if (parameter === 'width' && 'width' in primitive)
    primitive.width = value;
  else if (parameter === 'height' && 'height' in primitive)
    primitive.height = value;
  else if (parameter === 'radius' && primitive.kind === 'roundrect')
    primitive.radius = value;
}

/**
 * Handles placeholder parameters in the sketch flow.
 */
function placeholderParameters(
  primitive: CompactDimensionPrimitive,
): CompactSketchParameter[] {
  return Object.keys(
    primitive.dimensionPlaceholders ?? {},
  ) as CompactSketchParameter[];
}
