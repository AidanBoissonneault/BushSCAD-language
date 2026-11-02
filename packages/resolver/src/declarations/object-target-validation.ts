/**
 * @author Aidan Boissonneault
 * @file object-target-validation.ts
 * @purpose Provides object target validation behavior for the declarations in resolver package.
 * @last-edited October 6, 2026
 */

import type { ASTSourceSpan } from '@bushscad/ir';
import type { Scope } from '../core/scope.js';
import type { State } from '../core/types.js';
import { addError } from '../core/errors.js';
import { rejectSurfaceAsSolid } from '../geometry/surface.js';

/** Reports an error if `target` resolves to neither a local nor a global object. */
export function requireTargetObject(
  target: string,
  scope: Scope,
  state: State,
  span: ASTSourceSpan,
  context: string,
): void {
  const baseTarget = target.replace(/\[\d+\]$/, '');
  if (rejectSurfaceAsSolid(baseTarget, scope, state, span, context)) return;
  const kind = scope.lookup(baseTarget);
  if (kind === 'var') return;
  if (kind === null && !state.globalParts.has(baseTarget)) {
    addError(state, `Undefined object '${baseTarget}' in ${context}`, span);
  }
}
