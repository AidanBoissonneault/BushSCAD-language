/** Shared callback contracts for recursive object operation resolution. */
import type { ObjDecl } from '@bushscad/ir';
import type { Scope } from '../../core/scope.js';
import type { State } from '../../core/types.js';

/** Resolves a nested object declaration while retaining the current resolver state. */
export type ObjResolver = (stmt: ObjDecl, scope: Scope, state: State) => void;

/** Resolves one object operation and any nested object operands it owns. */
export type ObjOperationResolver = (
  stmt: ObjDecl,
  scope: Scope,
  state: State,
  resolveObj: ObjResolver,
) => void;
