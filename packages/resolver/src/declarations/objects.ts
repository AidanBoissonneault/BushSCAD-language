/**
 * @author Aidan Boissonneault
 * @file objects.ts
 * @purpose Provides objects behavior for the declarations in resolver package.
 * @last-edited October 6, 2026
 */

import type {
  AnonymousObjDecl,
  ObjDecl,
  ObjectOperation,
} from '@bushscad/ir';
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

/** Resolves an anonymous object's operation without registering a reusable name. */
export function resolveAnonymousObj(
  stmt: AnonymousObjDecl,
  scope: Scope,
  state: State,
): void {
  const profileName = anonymousObjectProfileName(stmt);
  state.resolveInlineObjectOperation(
    stmt.operation,
    profileName,
    scope,
    state,
  );
  state.objectProfileSegments.delete(profileName);
}

/** Resolves an inline object operation and records its selectable profile names. */
export function resolveInlineObjectOperation(
  operation: ObjectOperation,
  profileName: string,
  scope: Scope,
  state: State,
): void {
  state.objectProfileSegments.delete(profileName);
  resolveObjOperation(
    {
      kind: 'obj',
      name: profileName,
      operation,
      anchors: [],
      span: operation.span,
    },
    scope,
    state,
    resolveObj,
  );
}

/** Creates a private profile-map key for a bare object operation. */
function anonymousObjectProfileName(stmt: AnonymousObjDecl): string {
  const { file, line, col } = stmt.span;
  return `\u0000anonymous:${file}:${line}:${col}`;
}
