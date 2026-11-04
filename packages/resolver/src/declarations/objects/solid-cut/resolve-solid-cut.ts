import type { ObjDecl, SolidCutOp, SolidCutTool } from '@bushscad/ir';
import type { Scope } from '../../../core/scope.js';
import type { State } from '../../../core/types.js';
import { resolveExpr } from '../../../references/expressions.js';
import { resolveFromRef } from '../../../references/refs.js';
import { resolveNamedObjectInput } from '../../../references/operand-inputs.js';
import type { ObjResolver } from '../types.js';

/**
 * Resolves solid cut op against the current scope and reports unresolved references.
 */
export function resolveSolidCutOp(
  op: SolidCutOp,
  scope: Scope,
  state: State,
  resolveObj: ObjResolver,
): void {
  if (op.tool.kind === 'object') {
    resolveNamedObjectInput(op.tool.object, scope, state, 'solid cut');
  } else {
    resolveInlineSolidTool(op.tool.operation, scope, state, resolveObj);
  }
  resolveFromRef(op.from, scope, state, op.span, resolveExpr);
}

/** Resolves a solid-cut declaration while preserving recursive inline tools. */
export function resolveSolidCutObj(
  stmt: ObjDecl,
  scope: Scope,
  state: State,
  resolveObj: ObjResolver,
): void {
  resolveSolidCutOp(
    stmt.operation as Extract<ObjDecl['operation'], { kind: 'solid_cut' }>,
    scope,
    state,
    resolveObj,
  );
}

/**
 * Resolves inline solid tool against the current scope and reports unresolved references.
 */
function resolveInlineSolidTool(
  op: Extract<SolidCutTool, { kind: 'operation' }>['operation'],
  scope: Scope,
  state: State,
  resolveObj: ObjResolver,
): void {
  resolveObj(
    {
      kind: 'obj',
      name: '__solid_cut_tool__',
      operation: op,
      anchors: [],
      span: op.span,
    },
    scope,
    state,
  );
}
