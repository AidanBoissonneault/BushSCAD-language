/**
 * Evaluates user-defined and built-in function invocation statements.
 */
import type { CallStatement, IRFuse } from '@bushscad/ir';
import { addError, toSpan } from '../../core/eval-context.js';
import type { Deferred, EvalCtx } from '../../core/eval-types.js';
import { objectTargetNames } from '../../objects/eval-object-arrays.js';
import { evalFunctionImpl } from '../fn/eval-function.js';
import { functionCallNameSpan } from './function-call-name-span.js';
import type { FunctionBodyEvaluators } from '../function-body-evaluators.js';
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
