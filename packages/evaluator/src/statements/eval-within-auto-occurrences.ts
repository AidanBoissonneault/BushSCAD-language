/**
 * @author Aidan Boissonneault
 * @file eval-within-auto-occurrences.ts
 * @purpose Evaluates within auto occurrences for the statements in evaluator package.
 * @last-edited October 6, 2026
 */

import type {
  AutoExpr,
  ComponentBody,
  Expr,
  ObjectOperation,
  RepeatableSpatialRef,
} from '@bushscad/ir';
import { expandRepeatableSpatialRef } from '@bushscad/ir';
import { autoFixedTermsIn } from '../core/eval-auto-fixed-terms.js';
import type { Axis, FixedTerm } from '../core/eval-auto-types.js';

/**
 * One `auto` occurrence in a loop body: a distribution slot. Each occurrence
 * distributes independently across the loop's iterations.
 */
export interface AutoOccurrence {
  node: AutoExpr;
  axis: Axis;
  fixed: FixedTerm[];
}

/**
 * Collects every `auto` occurrence in a loop body, tagged with the axis its
 * surrounding argument implies.
 * `within` spacing has to solve x and y auto slots independently while keeping
 * fixed inline offsets attached to the exact auto node they modify.
 */
export function collectAutoOccurrences(body: ComponentBody): AutoOccurrence[] {
  const out: AutoOccurrence[] = [];
  walkComponentBody(body, out);
  return out;
}

/**
 * Handles walk component body in the statements flow.
 */
function walkComponentBody(body: ComponentBody, out: AutoOccurrence[]): void {
  for (const stmt of body.statements) {
    collectStatementAutoOccurrences(stmt, out);
  }
}

/**
 * Collects statement auto occurrences from the supplied values.
 */
function collectStatementAutoOccurrences(
  stmt: ComponentBody['statements'][number],
  out: AutoOccurrence[],
): void {
  switch (stmt.kind) {
    case 'var':
      visitAutoExpr(stmt.value, null, out);
      break;
    case 'obj':
      collectObjectAutoOccurrences(stmt.operation, out);
      break;
    case 'anonymousObj':
      collectObjectAutoOccurrences(stmt.operation, out);
      break;
    case 'place':
      collectPlaceAutoOccurrences(stmt, out);
      break;
    case 'callStmt':
      collectCallAutoOccurrences(stmt, out);
      break;
    case 'sketch':
      collectSketchAutoOccurrences(stmt, out);
      break;
    case 'if':
      walkComponentBody(stmt.then, out);
      if (stmt.else) walkComponentBody(stmt.else, out);
      break;
  }
}

/**
 * Collects object auto occurrences from the supplied values.
 */
function collectObjectAutoOccurrences(
  op: ObjectOperation,
  out: AutoOccurrence[],
): void {
  for (const { expr, axis } of operationAxisExprs(op)) {
    visitAutoExpr(expr, axis, out);
  }
}

/**
 * Collects place auto occurrences from the supplied values.
 */
function collectPlaceAutoOccurrences(
  stmt: Extract<ComponentBody['statements'][number], { kind: 'place' }>,
  out: AutoOccurrence[],
): void {
  if (stmt.target) collectPlacementAutoOccurrences(stmt.target, out);
  if (stmt.sourceAnchor)
    collectPlacementAutoOccurrences(stmt.sourceAnchor, out);
  for (const arg of stmt.args) visitAutoExpr(arg, null, out);
  for (const arg of stmt.namedArgs) visitAutoExpr(arg.value, null, out);
}

/**
 * Collects call auto occurrences from the supplied values.
 */
function collectCallAutoOccurrences(
  stmt: Extract<ComponentBody['statements'][number], { kind: 'callStmt' }>,
  out: AutoOccurrence[],
): void {
  for (const arg of stmt.call.args) visitAutoExpr(arg, null, out);
  for (const arg of stmt.call.namedArgs) visitAutoExpr(arg.value, null, out);
}

/**
 * Collects sketch auto occurrences from the supplied values.
 */
function collectSketchAutoOccurrences(
  stmt: Extract<ComponentBody['statements'][number], { kind: 'sketch' }>,
  out: AutoOccurrence[],
): void {
  if (stmt.primitive.kind !== 'rect') return;
  visitAutoExpr(stmt.primitive.width, 'x', out);
  visitAutoExpr(stmt.primitive.height, 'y', out);
}

/**
 * Collects placement auto occurrences from the supplied values.
 */
function collectPlacementAutoOccurrences(
  placement: RepeatableSpatialRef,
  out: AutoOccurrence[],
): void {
  for (const { expr, axis } of placementAxisExprs(placement)) {
    visitAutoExpr(expr, axis, out);
  }
}

/**
 * Handles visit auto expr in the statements flow.
 */
function visitAutoExpr(expr: Expr, axis: Axis, out: AutoOccurrence[]): void {
  for (const { node, fixed } of autoFixedTermsIn(expr)) {
    out.push({ node, axis, fixed });
  }
}

/**
 * Handles placement axis exprs in the statements flow.
 */
function placementAxisExprs(
  p: RepeatableSpatialRef,
): { expr: Expr; axis: Axis }[] {
  const out: { expr: Expr; axis: Axis }[] = [];
  for (const item of expandRepeatableSpatialRef(p)) {
    if (item.kind !== 'pos') continue;
    if (item.x) out.push({ expr: item.x, axis: 'x' });
    if (item.y) out.push({ expr: item.y, axis: 'y' });
    for (const x of [item.radius, item.angle, item.offset]) {
      if (x) out.push({ expr: x, axis: null });
    }
  }
  return out;
}

/**
 * Dispatches the operation to its matching action handler.
 */
function operationAxisExprs(op: ObjectOperation): { expr: Expr; axis: Axis }[] {
  const out: { expr: Expr; axis: Axis }[] = [];
  if (op.kind === 'solidPrimitive') {
    for (const arg of op.args) out.push({ expr: arg.value, axis: null });
    if (op.placement) out.push(...placementAxisExprs(op.placement));
    return out;
  }
  if ('depth' in op && op.depth) out.push({ expr: op.depth, axis: null });
  if ('from' in op && op.from) out.push(...placementAxisExprs(op.from));
  return out;
}
