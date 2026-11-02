/**
 * @author Aidan Boissonneault
 * @file sheet.ts
 * @purpose Provides sheet behavior for the geometry in resolver package.
 * @last-edited October 6, 2026
 */

import type { SheetDecl } from '@bushscad/ir';
import type { Scope } from '../core/scope.js';
import type { State } from '../core/types.js';
import { Scope as ScopeClass } from '../core/scope.js';
import { addError } from '../core/errors.js';
import { resolveExpr } from '../references/expressions.js';
import { resolveSketch } from '../sketch/sketch.js';

/**
 * Resolves a `sheet` block (M33): validates header settings, the base panel
 * sketch, and every flange's edge reference. Inner names live in a child scope.
 */
export function resolveSheet(
  stmt: SheetDecl,
  parent: Scope,
  state: State,
): void {
  resolveSheetHeader(stmt, parent, state);
  const scope = new ScopeClass(parent);
  predeclareSheetBody(stmt, scope);
  const baseObjCount = resolveSheetBody(stmt, scope, state);
  if (baseObjCount === 0) {
    addError(state, `sheet '${stmt.name}' has no sheet_base panel`, stmt.span);
  }
}

/**
 * Resolves sheet header against the current scope and reports unresolved references.
 */
function resolveSheetHeader(
  stmt: SheetDecl,
  parent: Scope,
  state: State,
): void {
  resolveExpr(stmt.thickness, parent, state);
  if (stmt.material) resolveExpr(stmt.material, parent, state);
  if (stmt.bendRadius) resolveExpr(stmt.bendRadius, parent, state);
  if (stmt.kFactor) resolveExpr(stmt.kFactor, parent, state);
}

/**
 * Handles predeclare sheet body in the geometry flow.
 */
function predeclareSheetBody(stmt: SheetDecl, scope: Scope): void {
  for (const s of stmt.body) {
    if (s.kind === 'sketch') scope.define(s.name, 'sketch');
    else if (s.kind === 'sheetObj') scope.define(s.name, 'obj');
    else if (s.kind === 'var') scope.define(s.name, 'var');
  }
}

/**
 * Resolves sheet body against the current scope and reports unresolved references.
 */
function resolveSheetBody(stmt: SheetDecl, scope: Scope, state: State): number {
  let baseObjCount = 0;
  const flangedEdges = new Set<string>();
  for (const s of stmt.body) {
    if (s.kind === 'sheetObj') baseObjCount += 1;
    resolveSheetBodyStmt(s, scope, state, flangedEdges);
  }
  return baseObjCount;
}

/**
 * Derives `SheetBodyStmt` from `SheetDecl['body'][number]` to preserve its type relationship in the
 * geometry layer.
 */
type SheetBodyStmt = SheetDecl['body'][number];

/**
 * Resolves sheet body stmt against the current scope and reports unresolved references.
 */
function resolveSheetBodyStmt(
  stmt: SheetBodyStmt,
  scope: Scope,
  state: State,
  flangedEdges: Set<string>,
): void {
  if (stmt.kind === 'sketch') resolveSketch(stmt, scope, state);
  else if (stmt.kind === 'var') resolveExpr(stmt.value, scope, state);
  else if (stmt.kind === 'sheetObj') resolveSheetObj(stmt, scope, state);
  else if (stmt.kind === 'flange') {
    resolveFlange(stmt, scope, state, flangedEdges);
  }
}

/**
 * Resolves sheet obj against the current scope and reports unresolved references.
 */
function resolveSheetObj(
  stmt: Extract<SheetBodyStmt, { kind: 'sheetObj' }>,
  scope: Scope,
  state: State,
): void {
  if (scope.lookup(stmt.sketch) === null) {
    addError(
      state,
      `Undefined sketch '${stmt.sketch}' in sheet_base`,
      stmt.span,
    );
  }
}

/**
 * Resolves flange against the current scope and reports unresolved references.
 */
function resolveFlange(
  stmt: Extract<SheetBodyStmt, { kind: 'flange' }>,
  scope: Scope,
  state: State,
  flangedEdges: Set<string>,
): void {
  if (scope.lookup(stmt.edgeObj) === null) {
    addError(
      state,
      `Undefined base panel '${stmt.edgeObj}' in flange`,
      stmt.span,
    );
  }
  const key = `${stmt.edgeObj}.${stmt.edgeName}`;
  if (flangedEdges.has(key)) {
    addError(state, `Edge '${key}' already has a flange`, stmt.span);
  }
  flangedEdges.add(key);
  resolveExpr(stmt.length, scope, state);
  resolveExpr(stmt.angle, scope, state);
  if (stmt.radius) resolveExpr(stmt.radius, scope, state);
}
