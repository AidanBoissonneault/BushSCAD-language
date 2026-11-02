/**
 * @author Aidan Boissonneault
 * @file program.ts
 * @purpose Provides program behavior for the core in resolver package.
 * @last-edited October 6, 2026
 */

import type { Program } from '@bushscad/ir';
import type { Scope } from './scope.js';
import type { State } from './types.js';
import { resolveFontImport, resolveImport } from '../modules/imports.js';
import { resolveTopStmt } from '../declarations/statements.js';

/**
 * Runs the second resolver pass over a full program.
 * Import resolution needs to recurse into child programs while sharing the same
 * program-level statement traversal behavior.
 */
export function resolveProgram(
  ast: Program,
  scope: Scope,
  state: State,
  filePath: string,
): void {
  for (const stmt of ast.statements) {
    resolveTopStmt(
      stmt,
      scope,
      state,
      filePath,
      (importStmt, importScope, importState, importFilePath) =>
        resolveImport(
          importStmt,
          importScope,
          importState,
          importFilePath,
          resolveProgram,
        ),
      resolveFontImport,
    );
  }
}
