/**
 * @author Aidan Boissonneault
 * @file eval-body-functions.ts
 * @purpose Evaluates body functions for the statements in evaluator package.
 * @last-edited October 6, 2026
 */

import type {
  ASTSourceSpan,
  CallStatement,
  ComponentStatement,
  Expr,
  FnDecl,
  FnCallExpr,
  IRFuse,
  IRPlacement,
} from '@bushscad/ir';
import { addError, childCtx, fresh, toSpan } from '../core/eval-context.js';
import type { Deferred, EvalCtx, FaceMetrics } from '../core/eval-types.js';
import { objectTargetNames } from '../objects/eval-object-arrays.js';
import { evalVarValue } from '../references/eval-selector-vars.js';
import { collectBodyLocalNames } from './eval-body-local-names.js';
import { collectBodyObjectNames } from './eval-body-object-names.js';
import { bindFunctionArguments } from './function-arguments.js';
import type { BodyStatementsEvaluator } from './eval-body-control-flow.js';

/**
 * Function body evaluators, including eval body statements and eval body stmt.
 */
interface FunctionBodyEvaluators {
  evalBodyStatements: BodyStatementsEvaluator;
  evalBodyStmt: (
    stmt: ComponentStatement,
    ctx: EvalCtx,
    deferred: Deferred,
  ) => void;
}

// Place rotation helper

// Place

// Call statement

/**
 * Evaluates call statement impl with the current evaluation context.
 */
export function evalCallStatementImpl(
  stmt: CallStatement,
  ctx: EvalCtx,
  deferred: Deferred,
  evaluators: FunctionBodyEvaluators,
): void {
  if (stmt.call.name === 'fuse') {
    emitFuseOperation(stmt, ctx);
    return;
  }
  const fn = ctx.functions.get(stmt.call.name);
  if (!fn) {
    addError(ctx, `Unknown function '${stmt.call.name}'`, stmt.span);
    return;
  }
  evalFunctionImpl(
    fn,
    stmt.call.args,
    stmt.call.namedArgs,
    ctx,
    deferred,
    ctx.activePlacement,
    ctx.thisContext,
    stmt.span,
    functionCallNameSpan(stmt.call),
    evaluators,
  );
}

/**
 * Lowers the built-in `fuse(a, b, ...)` statement to an explicit IR operation.
 * Explicit part bodies fuse by default, but default-scope bodies and user
 * workflows still need a direct way to request shared topology for named
 * objects.
 */
function emitFuseOperation(stmt: CallStatement, ctx: EvalCtx): void {
  if (stmt.call.namedArgs.length > 0) {
    addError(ctx, `fuse(...) only accepts positional object names`, stmt.span);
  }
  const targets: string[] = [];
  for (const arg of stmt.call.args) {
    if (arg.kind !== 'identifier') {
      addError(ctx, `fuse(...) arguments must be object names`, arg.span);
      continue;
    }
    targets.push(...objectTargetNames(arg.name, ctx));
  }
  if (targets.length < 2) {
    addError(ctx, `fuse(...) requires at least two object names`, stmt.span);
    return;
  }
  ctx.ops.push({
    kind: 'fuse',
    targets,
    span: toSpan(stmt.span),
  } satisfies IRFuse);
}

// Function evaluation

/**
 * Evaluates function impl with the current evaluation context.
 */
export function evalFunctionImpl(
  fn: FnDecl,
  args: Expr[],
  namedArgs: { name: string; value: Expr }[],
  ctx: EvalCtx,
  deferred: Deferred,
  placement: IRPlacement | null,
  thisContext: FaceMetrics | null,
  span: ASTSourceSpan,
  linkSpan: ASTSourceSpan,
  evaluators: FunctionBodyEvaluators,
): EvalCtx {
  const fnCtx = childCtx(ctx);
  fnCtx.activePlacement = placement;
  fnCtx.thisContext = thisContext;
  fnCtx.activeColor = ctx.activeColor;
  fnCtx.activeMaterial = ctx.activeMaterial;
  fnCtx.materialScopes.push(fn.name);

  const boundArgs = bindFunctionArguments(fn, { args, namedArgs }, ctx);
  fn.params.forEach((param, index) => {
    const argument = boundArgs.get(index);
    if (argument) {
      fnCtx.values.set(param.name, evalVarValue(argument, ctx));
    } else if (param.default) {
      fnCtx.values.set(param.name, evalVarValue(param.default, ctx));
    } else {
      addError(
        ctx,
        `Missing argument '${param.name}' for function '${fn.name}'`,
        span,
      );
      fnCtx.values.set(param.name, 0);
    }
  });

  const localNames = collectBodyLocalNames(fn.body);
  for (const n of localNames) fnCtx.names.set(n, fresh(ctx, n));

  const fnDeferred: Deferred = [];
  for (const s of fn.body.statements) {
    if (s.kind === 'return') {
      evaluators.evalBodyStatements(s.body, fnCtx, fnDeferred);
      break;
    }
    evaluators.evalBodyStmt(s, fnCtx, fnDeferred);
  }
  deferred.push(...fnDeferred);
  recordFunctionInvocation(fn, fnCtx, ctx, span, linkSpan);
  return fnCtx;
}

/** Returns the identifier-only source range for a parsed function call. */
export function functionCallNameSpan(call: FnCallExpr): ASTSourceSpan {
  return {
    ...call.span,
    endLine: call.span.line,
    endCol: call.span.col + call.name.length,
  };
}

/** Records concrete object outputs without changing emitted geometry IR. */
function recordFunctionInvocation(
  fn: FnDecl,
  fnCtx: EvalCtx,
  parentCtx: EvalCtx,
  span: ASTSourceSpan,
  linkSpan: ASTSourceSpan,
): void {
  const outputNames = [
    ...new Set(
      collectBodyObjectNames(fn.body).map(
        (name) => fnCtx.names.get(name) ?? name,
      ),
    ),
  ];
  if (outputNames.length === 0) return;
  parentCtx.interactionInvocations.push({
    name: fn.name,
    span: toSpan(span),
    linkSpan: toSpan(linkSpan),
    outputNames,
  });
}
