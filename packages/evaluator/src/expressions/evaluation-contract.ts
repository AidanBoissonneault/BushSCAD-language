import type { Expr } from '@bushscad/ir';
import type { EvalCtx, EvalValue } from '../core/eval-types.js';

/** Evaluates one expression using the current runtime context. */
export type EvalExpression = (expr: Expr, ctx: EvalCtx) => EvalValue;

/** Evaluates one numeric expression using the current runtime context. */
export type EvalNumberExpression = (expr: Expr, ctx: EvalCtx) => number;
