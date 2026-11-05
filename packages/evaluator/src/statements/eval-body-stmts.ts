/**
 * @author Aidan Boissonneault
 * @file eval-body-stmts.ts
 * @purpose Evaluates body stmts for the statements in evaluator package.
 * @last-edited October 6, 2026
 */

import type { ComponentBody, ComponentStatement, IROp } from '@bushscad/ir';

import type { Deferred, EvalCtx } from '../core/eval-types.js';

import {
  addError,
  captureScalarCacheContext,
  childCtx,
} from '../core/eval-context.js';

import { collectBodyObjectNames } from './eval-body-object-names.js';

import { evalPlace } from '../objects/eval-place.js';

import { evalForBodyControlFlow } from './for/eval-for-body-control-flow.js';
import { evalIfBodyControlFlow } from './if/eval-if-body-control-flow.js';

import { evalCallStatementImpl } from './call/eval-call-statement.js';
import { functionCallNameSpan } from './call/function-call-name-span.js';
import { evalFunctionImpl } from './fn/eval-function.js';

import { evalSharedStmt } from './eval-shared-statements.js';
import { evalBodySimpleStmt } from './eval-body-simple-stmts.js';
import { evalBodyModifierStmt } from './eval-body-modifier-stmts.js';

export { evalAssertStmt, evalSharedStmt } from './eval-shared-statements.js';

// Body statement evaluation

const bodyEvaluators = {
  evalBodyStatements,
  evalBodyStmt,
};

/**
 * Evaluates for with the current evaluation context.
 */
export function evalFor(
  stmt: Parameters<typeof evalForBodyControlFlow>[0],
  ctx: EvalCtx,
  deferred: Deferred,
): void {
  evalForBodyControlFlow(stmt, ctx, deferred, evalBodyStatements);
}

/**
 * Evaluates if with the current evaluation context.
 */
export function evalIf(
  stmt: Parameters<typeof evalIfBodyControlFlow>[0],
  ctx: EvalCtx,
  deferred: Deferred,
): void {
  evalIfBodyControlFlow(stmt, ctx, deferred, evalBodyStatements);
}

/**
 * Evaluates call statement with the current evaluation context.
 */
export function evalCallStatement(
  stmt: Parameters<typeof evalCallStatementImpl>[0],
  ctx: EvalCtx,
  deferred: Deferred,
): void {
  evalCallStatementImpl(stmt, ctx, deferred, bodyEvaluators);
}

/**
 * Evaluates function with the current evaluation context.
 */
export function evalFunction(
  fn: Parameters<typeof evalFunctionImpl>[0],
  args: Parameters<typeof evalFunctionImpl>[1],
  namedArgs: Parameters<typeof evalFunctionImpl>[2],
  ctx: EvalCtx,
  deferred: Deferred,
  placement: Parameters<typeof evalFunctionImpl>[5],
  thisContext: Parameters<typeof evalFunctionImpl>[6],
  span: Parameters<typeof evalFunctionImpl>[7],
  linkSpan: Parameters<typeof evalFunctionImpl>[8],
): ReturnType<typeof evalFunctionImpl> {
  return evalFunctionImpl(
    fn,
    args,
    namedArgs,
    ctx,
    deferred,
    placement,
    thisContext,
    span,
    linkSpan,
    bodyEvaluators,
  );
}

/**
 * Evaluates body statements with the current evaluation context.
 */
export function evalBodyStatements(
  body: ComponentBody,
  ctx: EvalCtx,
  deferred: Deferred,
): void {
  for (const stmt of body.statements) {
    evalBodyStmt(stmt, ctx, deferred);
  }
}

/**
 * Evaluates body stmt with the current evaluation context.
 */
export function evalBodyStmt(
  stmt: ComponentStatement,
  ctx: EvalCtx,
  deferred: Deferred,
): void {
  const opStart = ctx.ops.length;
  const deferredStart = deferred.length;
  try {
    if (evalSharedStmt(stmt, ctx)) return;
    if (evalBodySimpleStmt(stmt, ctx)) return;
    if (evalBodyModifierStmt(stmt, ctx, deferred)) return;
    switch (stmt.kind) {
    case 'objCall': {
      const fn = ctx.functions.get(stmt.call.name);
      if (!fn) {
        addError(ctx, `Unknown function '${stmt.call.name}'`, stmt.span);
        break;
      }
      const fnCtx = evalFunction(
        fn,
        stmt.call.args,
        stmt.call.namedArgs,
        ctx,
        deferred,
        ctx.activePlacement,
        ctx.thisContext,
        stmt.span,
        functionCallNameSpan(stmt.call),
      );
      const objNames = collectBodyObjectNames(fn.body, ctx.bodyNameFacts);
      if (objNames.length > 0) {
        const irName = fnCtx.names.get(objNames[0]) ?? objNames[0];
        ctx.names.set(stmt.name, irName);
      }
      break;
    }

    case 'callStmt':
      evalCallStatement(stmt, ctx, deferred);
      break;

    case 'for':
      evalFor(stmt, ctx, deferred);
      break;

    case 'if':
      evalIf(stmt, ctx, deferred);
      break;

    case 'place':
      evalPlace(stmt, ctx, deferred, { evalBodyStatements, evalFunction });
      break;
    }
  } finally {
    annotateConditionalCacheContext(ctx.ops, opStart, ctx);
    annotateConditionalCacheContext(deferred, deferredStart, ctx);
  }
}

/** Captures the current scalar scope only for conditional cache breakpoint source lines. */
function annotateConditionalCacheContext(
  operations: IROp[],
  startIndex: number,
  ctx: EvalCtx,
): void {
  if (ctx.cacheContextSpans.size === 0) return;
  for (let index = startIndex; index < operations.length; index++) {
    const operation = operations[index];
    if (
      !operation ||
      operation.cacheContext ||
      !ctx.cacheContextSpans.has(`${operation.span.file}\0${operation.span.line}`)
    )
      continue;
    const cacheContext = captureScalarCacheContext(ctx.values);
    if (Object.keys(cacheContext).length > 0)
      operations[index] = { ...operation, cacheContext };
  }
}

// Component body evaluation

/**
 * Evaluates component body with the current evaluation context.
 */
export function evalComponentBody(
  body: ComponentBody,
  parentCtx: EvalCtx,
  materialScope?: string,
): void {
  const ctx = childCtx(parentCtx);
  ctx.activeColor = parentCtx.activeColor;
  ctx.activeMaterial = parentCtx.activeMaterial;
  if (materialScope) ctx.materialScopes.push(materialScope);
  const deferred: Deferred = [];
  evalBodyStatements(body, ctx, deferred);
  for (const op of deferred) ctx.ops.push(op);
}
