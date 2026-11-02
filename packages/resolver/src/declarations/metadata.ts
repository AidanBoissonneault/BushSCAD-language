/**
 * @author Aidan Boissonneault
 * @file metadata.ts
 * @purpose Provides metadata behavior for the declarations in resolver package.
 * @last-edited October 6, 2026
 */

import type { MetadataAssignment } from '@bushscad/ir';
import type { Scope } from '../core/scope.js';
import type { State } from '../core/types.js';
import { addError } from '../core/errors.js';
import { resolveExpr } from '../references/expressions.js';

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

/**
 * Resolves a metadata assignment and validates its target scope.
 * Metadata assignment is a body-level declaration, not a general property
 * assignment. The resolver enforces that metadata is only used as a direct
 * part/ref body statement and that object metadata names an object in scope.
 */
export function resolveMetadataAssignment(
  stmt: MetadataAssignment,
  scope: Scope,
  state: State,
  allowPartMetadata: boolean,
): void {
  if (!allowPartMetadata) {
    const target = stmt.target.kind === 'part' ? 'part' : stmt.target.name;
    addError(
      state,
      `${target}.${stmt.property} is only valid as a direct statement inside a part or ref body`,
      stmt.span,
    );
  }

  if (
    stmt.target.kind === 'object' &&
    scope.lookup(stmt.target.name) !== 'obj'
  ) {
    addError(
      state,
      `Undefined object '${stmt.target.name}' in ${stmt.target.name}.${stmt.property}`,
      stmt.span,
    );
  }

  resolveExpr(stmt.value, scope, state);

  if (stmt.property === 'material') return;

  if (stmt.value.kind === 'string' && !HEX_COLOR_RE.test(stmt.value.value)) {
    addError(
      state,
      `color metadata expects a #rrggbb hex color string`,
      stmt.value.span,
    );
  }
}
