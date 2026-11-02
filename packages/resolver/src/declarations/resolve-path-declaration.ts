/**
 * @author Aidan Boissonneault
 * @file resolve-path-declaration.ts
 * @purpose Resolves path declaration for the declarations in resolver package.
 * @last-edited October 6, 2026
 */

import type { PathDecl } from '@bushscad/ir';
import type { Scope } from '../core/scope.js';
import type { State } from '../core/types.js';
import { addError } from '../core/errors.js';
import { resolveExpr } from '../references/expressions.js';

/**
 * Resolves path declaration against the current scope and reports unresolved references.
 */
export function resolvePathDecl(
  stmt: PathDecl,
  scope: Scope,
  state: State,
): void {
  if (stmt.primitive.points.length < 2) {
    addError(
      state,
      `path '${stmt.name}' requires at least 2 points`,
      stmt.span,
    );
  }
  for (const pt of stmt.primitive.points) {
    resolveExpr(pt.x, scope, state);
    resolveExpr(pt.y, scope, state);
    resolveExpr(pt.z, scope, state);
  }
}

/**
 * Returns whether the input meets the `known builtin library` condition.
 */
export function isKnownBuiltinLibrary(library: string): boolean {
  return KNOWN_BUILTIN_LIBRARY_PREFIXES.some((prefix) =>
    library.startsWith(prefix),
  );
}

export const KNOWN_BUILTIN_LIBRARY_PREFIXES = [
  'std.hardware.',
  'std.printing.',
  'std.machining.',
  'std.cutting.',
];
