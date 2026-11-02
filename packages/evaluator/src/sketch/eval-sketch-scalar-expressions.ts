/**
 * @author Aidan Boissonneault
 * @file eval-sketch-scalar-expressions.ts
 * @purpose Evaluates sketch scalar expressions for the sketch in evaluator package.
 * @last-edited October 6, 2026
 */

import type { ConstraintDecl, Expr, SketchDimensionDecl } from '@bushscad/ir';
import type {
  SolverDimension,
  SolverDimensionKind,
  SolverScalarExpression,
} from '@bushscad/sketch-solver';
import type { EvalCtx } from '../core/eval-types.js';
import { addError } from '../core/eval-context.js';
import { evalNum, unitToMm } from '../expressions/eval-expressions.js';

/** Builds live measurement bindings for named driving and reference dimensions. */
export function buildSolverDimensions(
  constraints: ConstraintDecl[],
  dimensions: SketchDimensionDecl[],
  aliases: Map<string, string>,
): SolverDimension[] {
  const driving = constraints.flatMap((constraint) => {
    if (!constraint.name || !isDimensionKind(constraint.constraint)) return [];
    return [
      {
        name: constraint.name,
        dimension: constraint.constraint,
        target: resolveName(constraint.target, aliases),
        ref: constraint.ref ? resolveName(constraint.ref, aliases) : undefined,
        axis: constraint.axis,
      } satisfies SolverDimension,
    ];
  });
  const reference = dimensions.flatMap((dimension) =>
    dimension.name
      ? [
          {
            name: dimension.name,
            dimension: dimension.dimension,
            target: resolveName(dimension.target, aliases),
            ref: dimension.ref
              ? resolveName(dimension.ref, aliases)
              : undefined,
            axis: dimension.axis,
          } satisfies SolverDimension,
        ]
      : [],
  );
  return [...driving, ...reference];
}

/** Lowers a numeric AST expression while retaining live local dimension leaves. */
export function evalSketchScalarExpression(
  expr: Expr,
  dimensionNames: Set<string>,
  ctx: EvalCtx,
): number | SolverScalarExpression {
  if (!sketchExpressionUsesDimension(expr, dimensionNames))
    return evalNum(expr, ctx);
  return lowerExpression(expr, dimensionNames, ctx);
}

/**
 * Handles lower expression in the sketch flow.
 */
function lowerExpression(
  expr: Expr,
  names: Set<string>,
  ctx: EvalCtx,
): SolverScalarExpression {
  if (expr.kind === 'number') return { kind: 'constant', value: expr.value };
  if (expr.kind === 'identifier') {
    return names.has(expr.name)
      ? { kind: 'dimension', name: expr.name }
      : { kind: 'constant', value: evalNum(expr, ctx) };
  }
  if (expr.kind === 'unit') return lowerUnitExpression(expr, names, ctx);
  if (expr.kind === 'unary' && expr.op === '-')
    return lowerNegation(expr, names, ctx);
  if (expr.kind === 'binary' && isSupportedBinary(expr.op))
    return lowerBinaryExpression(expr, names, ctx);
  addError(
    ctx,
    'Sketch dimension references support numeric literals, units, and +, -, *, /, or % arithmetic',
    expr.span,
  );
  return { kind: 'constant', value: 0 };
}

/**
 * Handles lower unit expression in the sketch flow.
 */
function lowerUnitExpression(
  expr: Extract<Expr, { kind: 'unit' }>,
  names: Set<string>,
  ctx: EvalCtx,
): SolverScalarExpression {
  const value = lowerExpression(expr.value, names, ctx);
  const scale = expr.unit === 'deg' ? 1 : unitToMm(expr.unit) / ctx.baseUnitMm;
  return foldBinary('*', value, { kind: 'constant', value: scale }, expr, ctx);
}

/**
 * Handles lower negation in the sketch flow.
 */
function lowerNegation(
  expr: Extract<Expr, { kind: 'unary' }>,
  names: Set<string>,
  ctx: EvalCtx,
): SolverScalarExpression {
  const operand = lowerExpression(expr.operand, names, ctx);
  return operand.kind === 'constant'
    ? { kind: 'constant', value: -operand.value }
    : { kind: 'negate', operand };
}

/**
 * Handles lower binary expression in the sketch flow.
 */
function lowerBinaryExpression(
  expr: Extract<Expr, { kind: 'binary' }>,
  names: Set<string>,
  ctx: EvalCtx,
): SolverScalarExpression {
  const op = expr.op as SupportedBinaryOperator;
  return foldBinary(
    op,
    lowerExpression(expr.left, names, ctx),
    lowerExpression(expr.right, names, ctx),
    expr,
    ctx,
  );
}

/**
 * Accepted values for supported binary operator are '+', '-', '*', '/', and '%'.
 */
type SupportedBinaryOperator = '+' | '-' | '*' | '/' | '%';

const constantOperations: Record<
  SupportedBinaryOperator,
  (left: number, right: number) => number
> = {
  '+': add,
  '-': subtract,
  '*': multiply,
  '/': divide,
  '%': remainder,
};

/**
 * Adds to its owning collection.
 */
function add(left: number, right: number): number {
  return left + right;
}

/**
 * Handles subtract in the sketch flow.
 */
function subtract(left: number, right: number): number {
  return left - right;
}

/**
 * Handles multiply in the sketch flow.
 */
function multiply(left: number, right: number): number {
  return left * right;
}

/**
 * Handles divide in the sketch flow.
 */
function divide(left: number, right: number): number {
  return left / right;
}

/**
 * Handles remainder in the sketch flow.
 */
function remainder(left: number, right: number): number {
  return left % right;
}

/**
 * Returns whether the input meets the `supported binary` condition.
 */
function isSupportedBinary(op: string): op is SupportedBinaryOperator {
  return Object.hasOwn(constantOperations, op);
}

/**
 * Handles fold binary in the sketch flow.
 */
function foldBinary(
  op: SupportedBinaryOperator,
  left: SolverScalarExpression,
  right: SolverScalarExpression,
  expr: Expr,
  ctx: EvalCtx,
): SolverScalarExpression {
  if (
    (op === '/' || op === '%') &&
    right.kind === 'constant' &&
    right.value === 0
  ) {
    addError(
      ctx,
      'Sketch dimension expression cannot divide by zero',
      expr.span,
    );
    return { kind: 'constant', value: 0 };
  }
  if (left.kind !== 'constant' || right.kind !== 'constant') {
    return { kind: 'binary', op, left, right };
  }
  return {
    kind: 'constant',
    value: constantOperations[op](left.value, right.value),
  };
}

/** Reports whether an expression contains a sketch-local measurement name. */
export function sketchExpressionUsesDimension(
  expr: Expr,
  names: Set<string>,
): boolean {
  if (expr.kind === 'identifier') return names.has(expr.name);
  if (expr.kind === 'binary') {
    return (
      sketchExpressionUsesDimension(expr.left, names) ||
      sketchExpressionUsesDimension(expr.right, names)
    );
  }
  if (expr.kind === 'unary')
    return sketchExpressionUsesDimension(expr.operand, names);
  if (expr.kind === 'ternary') {
    return (
      sketchExpressionUsesDimension(expr.condition, names) ||
      sketchExpressionUsesDimension(expr.then, names) ||
      sketchExpressionUsesDimension(expr.else, names)
    );
  }
  if (expr.kind === 'unit')
    return sketchExpressionUsesDimension(expr.value, names);
  if (expr.kind === 'tuple') {
    return (
      sketchExpressionUsesDimension(expr.x, names) ||
      sketchExpressionUsesDimension(expr.y, names)
    );
  }
  if (expr.kind === 'list') {
    return expr.items.some((item) =>
      sketchExpressionUsesDimension(item, names),
    );
  }
  if (expr.kind === 'call') {
    return (
      expr.args.some((item) => sketchExpressionUsesDimension(item, names)) ||
      expr.namedArgs.some((item) =>
        sketchExpressionUsesDimension(item.value, names),
      )
    );
  }
  return false;
}

/**
 * Returns whether the input meets the `dimension kind` condition.
 */
function isDimensionKind(
  kind: ConstraintDecl['constraint'],
): kind is SolverDimensionKind {
  return ['length', 'distance', 'angle', 'radius', 'diameter'].includes(kind);
}

/**
 * Resolves name using the sketch rules.
 */
function resolveName(name: string, aliases: Map<string, string>): string {
  return aliases.get(name) ?? name;
}
