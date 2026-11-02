/**
 * @author Aidan Boissonneault
 * @file eval-auto-expression-walk.ts
 * @purpose Evaluates auto expression walk for the core in evaluator package.
 * @last-edited October 6, 2026
 */

import type { AutoExpr, Expr } from '@bushscad/ir';

/**
 * Returns direct child expressions for evaluator tree walks.
 *
 * This traversal is shared by expression evaluation and `within` loop planning,
 * and stays pure to avoid evaluator import cycles.
 */
export function exprChildren(e: Expr): Expr[] {
  switch (e.kind) {
    case 'binary':
      return [e.left, e.right];
    case 'unary':
      return [e.operand];
    case 'ternary':
      return [e.condition, e.then, e.else];
    case 'unit':
      return [e.value];
    case 'list':
      return e.items;
    case 'template':
      return e.parts.flatMap((part) =>
        part.kind === 'expression' ? [part.expression] : [],
      );
    case 'tuple':
      return [e.x, e.y];
    case 'call':
      return [...e.args, ...e.namedArgs.map((a) => a.value)];
    case 'pos':
      return posExprChildren(e);
    default:
      return [];
  }
}

/** True if the expression tree contains an `auto` keyword anywhere. */
export function exprContainsAuto(e: Expr): boolean {
  if (e.kind === 'auto') return true;
  return exprChildren(e).some(exprContainsAuto);
}

/** Every `auto` node in an expression tree, in source order. */
export function autoNodesIn(e: Expr): AutoExpr[] {
  if (e.kind === 'auto') return [e];
  return exprChildren(e).flatMap(autoNodesIn);
}

/**
 * Handles count auto in the core flow.
 */
export function countAuto(e: Expr): number {
  return autoNodesIn(e).length;
}

/**
 * Handles pos expr children in the core flow.
 */
function posExprChildren(e: Extract<Expr, { kind: 'pos' }>): Expr[] {
  const out: Expr[] = [];
  for (const x of [e.x, e.y, e.radius, e.angle, e.offset]) {
    if (x) out.push(x);
  }
  if (Array.isArray(e.anchor)) out.push(...e.anchor);
  return out;
}
