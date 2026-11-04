import type { ComponentStatement } from '@bushscad/ir';
import type { Scope } from '../../../core/scope.js';

/**
 * Resolves body env against the current scope and reports unresolved references.
 */
export function resolveBodyEnv(stmt: ComponentStatement, scope: Scope): void {
  scope.define(
    (stmt as Extract<ComponentStatement, { kind: 'env' }>).name,
    'env',
  );
}
