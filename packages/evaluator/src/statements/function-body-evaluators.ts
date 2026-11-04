/**
 * Callbacks used to evaluate statements inside a user-defined function.
 */
import type { ComponentStatement } from '@bushscad/ir';
import type { Deferred, EvalCtx } from '../core/eval-types.js';
import type { BodyStatementsEvaluator } from './body-statements-evaluator.js';

export interface FunctionBodyEvaluators {
  evalBodyStatements: BodyStatementsEvaluator;
  evalBodyStmt: (
    stmt: ComponentStatement,
    ctx: EvalCtx,
    deferred: Deferred,
  ) => void;
}
