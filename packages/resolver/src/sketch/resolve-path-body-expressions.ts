/**
 * @author Aidan Boissonneault
 * @file resolve-path-body-expressions.ts
 * @purpose Resolves path body expressions for the sketch in resolver package.
 * @last-edited October 6, 2026
 */

import type {
  PathBodyExpression,
  PathBodyExpressionDecl,
  PathClosedBodyDecl,
  PathIgnoredBodyExpressionDecl,
  PathSketchPrimitive,
} from '@bushscad/ir';
import type { Scope } from '../core/scope.js';
import type { State } from '../core/types.js';
import { addError } from '../core/errors.js';
import { resolveSketchPoint } from './resolve-points.js';

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
 * Resolves path-local body aliases and validates their feature dependencies.
 * Body expressions share a sequential alias namespace while path features are
 * visible throughout the path. Keeping that precedence here makes `a = loop(x)`
 * followed by `b = a - y` deterministic without conflating body and segment
 * declarations in the main path resolver.
 */
export function resolvePathBodyExpressions(
  primitive: PathSketchPrimitive,
  segmentNames: ReadonlySet<string>,
  scope: Scope,
  state: State,
): void {
  const aliases = new Set<string>();
  for (const item of orderedBodyDeclarations(primitive)) {
    if (item.kind === 'ignoredExpression') {
      resolveBodyExpression(
        item.declaration.expression,
        aliases,
        segmentNames,
        state,
      );
      continue;
    }
    if (aliases.has(item.declaration.name)) {
      addError(
        state,
        `Duplicate closed body '${item.declaration.name}'`,
        item.declaration.span,
      );
    }
    if (item.kind === 'point') {
      resolveSketchPoint(item.declaration.point, scope, state);
    } else {
      resolveBodyExpression(
        item.declaration.expression,
        aliases,
        segmentNames,
        state,
      );
    }
    aliases.add(item.declaration.name);
  }

  for (const declaration of primitive.ignoredClosedBodies) {
    resolveSketchPoint(declaration.point, scope, state);
  }
}

/**
 * Handles ordered body declarations in the sketch flow.
 */
function orderedBodyDeclarations(
  primitive: PathSketchPrimitive,
): BodyDeclaration[] {
  return [
    ...primitive.closedBodies.map(
      (declaration): BodyDeclaration => ({
        kind: 'point',
        declaration,
      }),
    ),
    ...primitive.bodyExpressions.map(
      (declaration): BodyDeclaration => ({
        kind: 'expression',
        declaration,
      }),
    ),
    ...primitive.ignoredBodyExpressions.map(
      (declaration): BodyDeclaration => ({
        kind: 'ignoredExpression',
        declaration,
      }),
    ),
  ].sort((a, b) => compareSpans(a.declaration.span, b.declaration.span));
}

/**
 * Resolves body expression against the current scope and reports unresolved references.
 */
function resolveBodyExpression(
  expression: PathBodyExpression,
  aliases: ReadonlySet<string>,
  segmentNames: ReadonlySet<string>,
  state: State,
): void {
  if (expression.kind === 'pathBodyBoolean') {
    resolveBodyExpression(expression.left, aliases, segmentNames, state);
    resolveBodyExpression(expression.right, aliases, segmentNames, state);
    return;
  }
  if (expression.kind === 'pathBodyLoop') {
    validateFeature(
      expression.featureName,
      segmentNames,
      expression.span,
      state,
    );
    return;
  }
  if (aliases.has(expression.name)) return;
  validateFeature(expression.name, segmentNames, expression.span, state);
}

/**
 * Validates feature and reports any violations.
 */
function validateFeature(
  name: string,
  segmentNames: ReadonlySet<string>,
  span: PathBodyExpression['span'],
  state: State,
): void {
  if (segmentNames.has(name)) return;
  addError(state, `Unknown path body or feature '${name}'`, span);
}

/**
 * Compares spans using the requested criteria.
 */
function compareSpans(
  a: PathBodyExpression['span'],
  b: PathBodyExpression['span'],
): number {
  return a.line - b.line || a.col - b.col;
}
