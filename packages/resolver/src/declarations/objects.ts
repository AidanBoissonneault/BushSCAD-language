/**
 * @author Aidan Boissonneault
 * @file objects.ts
 * @purpose Provides objects behavior for the declarations in resolver package.
 * @last-edited October 6, 2026
 */

import type { ObjDecl } from '@bushscad/ir';
import type { Scope } from '../core/scope.js';
import type { State } from '../core/types.js';
import { resolveExpr } from '../references/expressions.js';
import { resolveFromRef } from '../references/refs.js';
import { resolveObjOperation } from './object-operation-resolvers.js';
import { recordSelectorAlias } from '../references/selector-aliases.js';

/**
 * Resolves an object declaration's operation and declared anchor references.
 */
export function resolveObj(stmt: ObjDecl, scope: Scope, state: State): void {
  resolveObjOperation(stmt, scope, state, resolveObj);
  for (const anchor of stmt.anchors) {
    resolveFromRef(anchor.point, scope, state, anchor.span, resolveExpr);
    recordSelectorAlias(anchor.name, anchor.point, scope, state);
  }
}
