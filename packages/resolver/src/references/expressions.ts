/**
 * @author Aidan Boissonneault
 * @file expressions.ts
 * @purpose Provides expressions behavior for the references in resolver package.
 * @last-edited October 6, 2026
 */

import type { Expr } from '@bushscad/ir';
import type { Scope } from '../core/scope.js';
import type { State } from '../core/types.js';
import { addError } from '../core/errors.js';
import {
  resolveFaceRef,
  resolvePosRef,
  resolveRepeatableFaceRef,
} from './refs.js';

/**
 * Resolves every reference embedded in an expression tree.
 */
export function resolveExpr(expr: Expr, scope: Scope, state: State): void {
  EXPR_RESOLVERS[expr.kind]?.(expr, scope, state);
}

/**
 * Defines the `ExprResolver` callback contract used by the references layer.
 */
type ExprResolver = (expr: Expr, scope: Scope, state: State) => void;

const EXPR_RESOLVERS: Partial<Record<Expr['kind'], ExprResolver>> = {
  list: resolveListExpr,
  template: resolveTemplateExpr,
  tuple: resolveTupleExpr,
  identifier: resolveIdentifierExpr,
  binary: resolveBinaryExpr,
  unary: resolveUnaryExpr,
  ternary: resolveTernaryExpr,
  this: resolveThisExpr,
  faceRef: (expr, scope, state) =>
    resolveFaceRef(
      expr as Extract<Expr, { kind: 'faceRef' }>,
      scope,
      state,
      expr.span,
      resolveExpr,
    ),
  faceRefList: (expr, scope, state) =>
    resolveRepeatableFaceRef(
      expr as Extract<Expr, { kind: 'faceRefList' }>,
      scope,
      state,
      expr.span,
      resolveExpr,
    ),
  pos: (expr, scope, state) =>
    resolvePosRef(
      expr as Extract<Expr, { kind: 'pos' }>,
      scope,
      state,
      resolveExpr,
    ),
  unit: (expr, scope, state) =>
    resolveExpr((expr as Extract<Expr, { kind: 'unit' }>).value, scope, state),
  call: resolveCallExpr,
  auto: resolveAutoExpr,
};

/**
 * Resolves template expr against the current scope and reports unresolved references.
 */
function resolveTemplateExpr(expr: Expr, scope: Scope, state: State): void {
  const template = expr as Extract<Expr, { kind: 'template' }>;
  for (const part of template.parts) {
    if (part.kind === 'expression') resolveExpr(part.expression, scope, state);
  }
}

/**
 * Resolves list expr against the current scope and reports unresolved references.
 */
function resolveListExpr(expr: Expr, scope: Scope, state: State): void {
  for (const item of (expr as Extract<Expr, { kind: 'list' }>).items) {
    resolveExpr(item, scope, state);
  }
}

/**
 * Resolves tuple expr against the current scope and reports unresolved references.
 */
function resolveTupleExpr(expr: Expr, scope: Scope, state: State): void {
  const tuple = expr as Extract<Expr, { kind: 'tuple' }>;
  resolveExpr(tuple.x, scope, state);
  resolveExpr(tuple.y, scope, state);
}

/**
 * Resolves identifier expr against the current scope and reports unresolved references.
 */
function resolveIdentifierExpr(expr: Expr, scope: Scope, state: State): void {
  const identifier = expr as Extract<Expr, { kind: 'identifier' }>;
  if (
    scope.lookup(identifier.name) === null &&
    !state.globalAnchors.has(identifier.name)
  ) {
    addError(state, `Undefined variable '${identifier.name}'`, identifier.span);
  }
}

/**
 * Resolves binary expr against the current scope and reports unresolved references.
 */
function resolveBinaryExpr(expr: Expr, scope: Scope, state: State): void {
  const binary = expr as Extract<Expr, { kind: 'binary' }>;
  resolveExpr(binary.left, scope, state);
  resolveExpr(binary.right, scope, state);
}

/**
 * Resolves unary expr against the current scope and reports unresolved references.
 */
function resolveUnaryExpr(expr: Expr, scope: Scope, state: State): void {
  resolveExpr((expr as Extract<Expr, { kind: 'unary' }>).operand, scope, state);
}

/**
 * Resolves ternary expr against the current scope and reports unresolved references.
 */
function resolveTernaryExpr(expr: Expr, scope: Scope, state: State): void {
  const ternary = expr as Extract<Expr, { kind: 'ternary' }>;
  resolveExpr(ternary.condition, scope, state);
  resolveExpr(ternary.then, scope, state);
  resolveExpr(ternary.else, scope, state);
}

/**
 * Resolves this expr against the current scope and reports unresolved references.
 */
function resolveThisExpr(expr: Expr, _scope: Scope, state: State): void {
  if (!state.inComponent) {
    addError(
      state,
      `'this.' used outside of component or part body`,
      expr.span,
    );
  }
}

/**
 * Resolves call expr against the current scope and reports unresolved references.
 */
function resolveCallExpr(expr: Expr, scope: Scope, state: State): void {
  const call = expr as Extract<Expr, { kind: 'call' }>;
  for (const arg of call.args) resolveExpr(arg, scope, state);
  for (const { value } of call.namedArgs) resolveExpr(value, scope, state);
}

/**
 * Resolves auto expr against the current scope and reports unresolved references.
 */
function resolveAutoExpr(expr: Expr, _scope: Scope, state: State): void {
  if (!state.inWithinLoop && !state.inComponent) {
    addError(
      state,
      `'auto' requires a 'within' loop or a parent-face context`,
      expr.span,
    );
  }
}
