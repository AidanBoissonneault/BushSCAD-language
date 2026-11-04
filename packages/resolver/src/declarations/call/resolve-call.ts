/** Resolves the call statement behavior in the declarations layer. */

import { resolveFuseCall } from '../fuse/resolve-fuse-call.js';
import type { ASTSourceSpan, FnCallExpr } from '@bushscad/ir';
import type { Scope } from '../../core/scope.js';
import type { State } from '../../core/types.js';
import { addError } from '../../core/errors.js';
import { resolveExpr } from '../../references/expressions.js';
import { isSelectorNameValue } from '../../references/selector-vars.js';

/** Resolves a function call: validates the callee name and every argument. */
export function resolveCall(
  call: FnCallExpr,
  span: ASTSourceSpan,
  scope: Scope,
  state: State,
): void {
  if (call.name === 'fuse') {
    resolveFuseCall(call, span, scope, state);
    return;
  }
  if (scope.lookup(call.name) === null) {
    addError(state, `Undefined function '${call.name}'`, span);
  }
  for (const arg of call.args) {
    if (!isSelectorNameValue(arg)) resolveExpr(arg, scope, state);
  }
  for (const { value } of call.namedArgs) {
    if (!isSelectorNameValue(value)) resolveExpr(value, scope, state);
  }
}
