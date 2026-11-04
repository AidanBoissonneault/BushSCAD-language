/**
 * Evaluates a user-defined function body in a child context.
 */
import type { ASTSourceSpan, Expr, FnDecl, IRPlacement } from '@bushscad/ir';
import { addError, childCtx, fresh, toSpan } from '../../core/eval-context.js';
import type { Deferred, EvalCtx, FaceMetrics } from '../../core/eval-types.js';
import { evalVarValue } from '../../references/eval-selector-vars.js';
import { collectBodyLocalNames } from '../eval-body-local-names.js';
import { collectBodyObjectNames } from '../eval-body-object-names.js';
import { bindFunctionArguments } from '../function-arguments.js';
import type { FunctionBodyEvaluators } from '../function-body-evaluators.js';
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
