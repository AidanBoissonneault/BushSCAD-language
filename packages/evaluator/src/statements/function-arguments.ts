/**
 * @author Aidan Boissonneault
 * @file function-arguments.ts
 * @purpose Provides function arguments behavior for the statements in evaluator package.
 * @last-edited October 6, 2026
 */

import type { Expr, FnCallExpr, FnDecl } from '@bushscad/ir';
import type { EvalCtx } from '../core/eval-types.js';
import { addError } from '../core/eval-context.js';

/**
 * Ordered argument is tagged by kind: 'positional' and 'named' carries name.
 */
type OrderedArgument =
  | { kind: 'positional'; value: Expr }
  | { kind: 'named'; name: string; value: Expr };

/**
 * Binds a function call's arguments to parameter positions and diagnoses bad
 * names, duplicate assignments, and excess positional values.
 *
 * Why:
 * The AST stores named and positional arguments separately, so source spans
 * restore their authored order before positional values fill unassigned slots.
 */
export function bindFunctionArguments(
  fn: FnDecl,
  call: Pick<FnCallExpr, 'args' | 'namedArgs'>,
  ctx: EvalCtx,
): ReadonlyMap<number, Expr> {
  const supplied = new Map<number, Expr>();
  const ordered: OrderedArgument[] = [
    ...call.args.map((value) => ({ kind: 'positional' as const, value })),
    ...call.namedArgs.map(({ name, value }) => ({
      kind: 'named' as const,
      name,
      value,
    })),
  ].sort(compareArgumentPosition);

  let nextPositional = 0;
  for (const argument of ordered) {
    if (argument.kind === 'named') {
      bindNamedArgument(argument, fn, supplied, ctx);
      continue;
    }

    while (supplied.has(nextPositional)) nextPositional++;
    if (nextPositional >= fn.params.length) {
      addError(
        ctx,
        `Function '${fn.name}' accepts at most ${fn.params.length} positional argument(s)`,
        argument.value.span,
      );
      continue;
    }
    supplied.set(nextPositional, argument.value);
    nextPositional++;
  }

  return supplied;
}

/**
 * Handles bind named argument in the statements flow.
 */
function bindNamedArgument(
  argument: Extract<OrderedArgument, { kind: 'named' }>,
  fn: FnDecl,
  supplied: Map<number, Expr>,
  ctx: EvalCtx,
): void {
  const index = fn.params.findIndex((param) => param.name === argument.name);
  if (index < 0) {
    addError(
      ctx,
      `Function '${fn.name}' does not accept argument '${argument.name}'`,
      argument.value.span,
    );
    return;
  }
  if (supplied.has(index)) {
    addError(
      ctx,
      `Function '${fn.name}' got duplicate argument '${argument.name}'`,
      argument.value.span,
    );
    return;
  }
  supplied.set(index, argument.value);
}

/**
 * Compares argument position using the requested criteria.
 */
function compareArgumentPosition(
  left: OrderedArgument,
  right: OrderedArgument,
): number {
  return (
    left.value.span.line - right.value.span.line ||
    left.value.span.col - right.value.span.col
  );
}
