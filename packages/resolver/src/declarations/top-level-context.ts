/** Owns context declaration resolution behavior. */
import type { TopLevelStatement } from '@bushscad/ir';
import type { Scope } from '../core/scope.js';
import type { State } from '../core/types.js';

/**
 * Defines the `ResolveImportFn` callback contract used by the declarations layer.
 */
export type ResolveImportFn = (
  stmt: Extract<TopLevelStatement, { kind: 'import' }>,
  scope: Scope,
  state: State,
  filePath: string,
) => void;

/**
 * Defines the `ResolveFontImportFn` callback contract used by the declarations layer.
 */
export type ResolveFontImportFn = (
  stmt: Extract<TopLevelStatement, { kind: 'fontImport' }>,
  state: State,
  filePath: string,
) => void;

/**
 * Context for top stmt, including source file path, resolve import, and resolve font import.
 */
export type TopStmtContext = {
  filePath: string;
  resolveImport: ResolveImportFn;
  resolveFontImport: ResolveFontImportFn;
  resolveTopStmt: (
    stmt: TopLevelStatement,
    scope: Scope,
    state: State,
    context: TopStmtContext,
  ) => void;
};
