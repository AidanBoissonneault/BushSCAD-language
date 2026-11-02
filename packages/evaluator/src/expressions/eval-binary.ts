/**
 * @author Aidan Boissonneault
 * @file eval-binary.ts
 * @purpose Evaluates binary for the expressions in evaluator package.
 * @last-edited October 6, 2026
 */

import type { Expr } from '@bushscad/ir';
import type { EvalValue } from '../core/eval-types.js';

/**
 * Derives `BinaryOp` from `Extract<Expr, { kind: 'binary' }>['op']` to preserve its type relationship
 * in the expressions layer.
 */
type BinaryOp = Extract<Expr, { kind: 'binary' }>['op'];

/**
 * Identifies operators whose operands must both be numbers.
 *
 * Why:
 * BushSCAD allows truthiness and strict equality across value types, while
 * arithmetic and ordering are numeric-only and must not inherit JavaScript coercion.
 */
export function isNumericBinaryOperator(op: BinaryOp): boolean {
  return (
    op === '+' ||
    op === '-' ||
    op === '*' ||
    op === '/' ||
    op === '%' ||
    op === '<' ||
    op === '>' ||
    op === '<=' ||
    op === '>='
  );
}

/**
 * Evaluates a binary expression operator against already-evaluated operands.
 * Normal expression evaluation and assert preflight evaluation intentionally
 * use the same arithmetic and comparison semantics, differing only in the
 * value returned for division by zero.
 */
export function evalBinaryValue(
  op: BinaryOp,
  left: EvalValue,
  right: EvalValue,
  divideByZero: EvalValue,
): EvalValue {
  switch (op) {
    case '+':
      return (left as number) + (right as number);
    case '-':
      return (left as number) - (right as number);
    case '*':
      return (left as number) * (right as number);
    case '/':
      return (right as number) !== 0
        ? (left as number) / (right as number)
        : divideByZero;
    case '%':
      return (left as number) % (right as number);
    case '==':
      return left === right;
    case '!=':
      return left !== right;
    case '<':
      return (left as number) < (right as number);
    case '>':
      return (left as number) > (right as number);
    case '<=':
      return (left as number) <= (right as number);
    case '>=':
      return (left as number) >= (right as number);
    case '&&':
      return Boolean(left) && Boolean(right);
    case '||':
      return Boolean(left) || Boolean(right);
  }
}

/**
 * Evaluates assert-time binary operators with `null` representing deferral.
 */
export function evalAssertBinaryValue(
  op: BinaryOp,
  left: number | boolean,
  right: number | boolean,
): number | boolean | null {
  if (
    isNumericBinaryOperator(op) &&
    (typeof left !== 'number' || typeof right !== 'number')
  ) {
    return null;
  }
  if (op === '/' && right === 0) return null;
  const value = evalBinaryValue(op, left, right, 0);
  return typeof value === 'number' || typeof value === 'boolean' ? value : null;
}
