/** Resolves the fuse statement behavior in the declarations layer. */

import type { ASTSourceSpan, FnCallExpr } from '@bushscad/ir';
import type { Scope } from '../../core/scope.js';
import type { State } from '../../core/types.js';
import { addError } from '../../core/errors.js';
import { resolveExpr } from '../../references/expressions.js';
import { requireTargetObject } from '../object-target-validation.js';

/**
 * Resolves the built-in `fuse(...)` statement.
 * `fuse` looks like a function call in the grammar, but it mutates OCCT body
 * ownership instead of evaluating a user function. Its arguments must be known
 * solid object names so the evaluator can lower them directly to IR.
 */
export function resolveFuseCall(
  call: FnCallExpr,
  span: ASTSourceSpan,
  scope: Scope,
  state: State,
): void {
  if (call.namedArgs.length > 0) {
    addError(state, `fuse(...) only accepts positional object names`, span);
  }
  if (call.args.length < 2) {
    addError(state, `fuse(...) requires at least two object names`, span);
  }
  for (const arg of call.args) {
    if (arg.kind !== 'identifier') {
      addError(state, `fuse(...) arguments must be object names`, arg.span);
      resolveExpr(arg, scope, state);
      continue;
    }
    requireTargetObject(arg.name, scope, state, arg.span, 'fuse');
  }
}
