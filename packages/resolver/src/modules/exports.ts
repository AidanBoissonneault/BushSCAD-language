/**
 * @author Aidan Boissonneault
 * @file exports.ts
 * @purpose Provides exports behavior for the modules in resolver package.
 * @last-edited October 6, 2026
 */

import type { ExportDecl, TopLevelStatement } from '@bushscad/ir';
import type { State, SymKind } from '../core/types.js';
import type { Scope } from '../core/scope.js';

const SYMBOL_KIND_BY_STATEMENT_KIND: Partial<
  Record<TopLevelStatement['kind'], SymKind>
> = {
  var: 'var',
  env: 'env',
  fontImport: 'font',
  sketch: 'sketch',
  surface: 'surface',
  obj: 'obj',
  refObj: 'obj',
  fn: 'fn',
  part: 'part',
  refPart: 'component',
};

/**
 * Returns a top-level statement as a named statement when the AST node carries a name.
 */
function namedStmt(
  stmt: TopLevelStatement,
): (TopLevelStatement & { name: string }) | null {
  if ('name' in stmt && typeof (stmt as { name: unknown }).name === 'string') {
    return stmt as TopLevelStatement & { name: string };
  }
  return null;
}

/**
 * Maps AST declaration kinds to resolver symbol kinds.
 */
function symKindFor(stmt: TopLevelStatement): SymKind | null {
  return SYMBOL_KIND_BY_STATEMENT_KIND[stmt.kind] ?? null;
}

/**
 * Collects exported declarations by public name for import resolution.
 */
export function collectExports(ast: {
  statements: TopLevelStatement[];
}): Map<string, ExportDecl> {
  const exports = new Map<string, ExportDecl>();
  for (const stmt of ast.statements) {
    if (stmt.kind !== 'export') continue;
    const inner = namedStmt(stmt.statement);
    if (inner) exports.set(inner.name, stmt);
  }
  return exports;
}

/**
 * Returns an export declaration with an aliased inner name when needed.
 */
export function exportWithName(exp: ExportDecl, name: string): ExportDecl {
  const inner = namedStmt(exp.statement);
  if (!inner || inner.name === name) return exp;
  return {
    ...exp,
    statement: { ...inner, name } as TopLevelStatement,
  };
}

/**
 * Defines an imported export in the receiving scope and shared resolver indexes.
 */
export function defineImportedExport(
  scope: Scope,
  state: State,
  exp: ExportDecl,
): void {
  const inner = namedStmt(exp.statement);
  if (!inner) return;
  const kind = symKindFor(inner);
  if (!kind) return;
  scope.define(inner.name, kind);
  if (kind === 'part' || kind === 'component') {
    state.globalParts.add(inner.name);
  }
}
