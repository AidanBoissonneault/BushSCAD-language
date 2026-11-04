/**
 * Evaluates an if statement in a child context.
 */
import type { IfStatement } from '@bushscad/ir';
import { childCtx } from '../../core/eval-context.js';
import type { Deferred, EvalCtx } from '../../core/eval-types.js';
import { evalBool } from '../../expressions/eval-expressions.js';
import type { BodyStatementsEvaluator } from '../body-statements-evaluator.js';
/**
 * Evaluates an if statement in a child context.
 */
export function evalIfBodyControlFlow(
  stmt: IfStatement,
  ctx: EvalCtx,
  deferred: Deferred,
  evalBodyStatements: BodyStatementsEvaluator,
): void {
  const branch = evalBool(stmt.condition, ctx) ? stmt.then : stmt.else;
  if (branch === null) return;
  const branchCtx = childCtx(ctx);
  branchCtx.activeColor = ctx.activeColor;
  branchCtx.activeMaterial = ctx.activeMaterial;
  evalBodyStatements(branch, branchCtx, deferred);
}
