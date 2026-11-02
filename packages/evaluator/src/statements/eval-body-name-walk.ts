/**
 * @author Aidan Boissonneault
 * @file eval-body-name-walk.ts
 * @purpose Evaluates body name walk for the statements in evaluator package.
 * @last-edited October 6, 2026
 */

import type { ComponentBody, ComponentStatement } from '@bushscad/ir';

/**
 * Accepted values for named body kind are 'sketch', 'surface', 'path', 'obj', 'objCall', and
 * 'refObj'.
 */
type NamedBodyKind =
  | 'sketch'
  | 'surface'
  | 'path'
  | 'obj'
  | 'objCall'
  | 'refObj';

/**
 * Selected members of ComponentStatement used for named body statement.
 */
type NamedBodyStatement = Extract<ComponentStatement, { kind: NamedBodyKind }>;

/**
 * Collects deduplicated names from nested body statements.
 * Local-name and object-name passes share the same traversal but intentionally
 * keep different public entry points for loop renaming and anchor resolution.
 */
export function collectBodyNames(
  body: ComponentBody,
  accepts: (kind: NamedBodyKind) => boolean,
): string[] {
  const names: string[] = [];
  /**
   * Adds name to its owning collection.
   */
  const addName = (name: string): void => {
    if (!names.includes(name)) names.push(name);
  };
  /**
   * Collects from the supplied values.
   */
  const collect = (inner: ComponentBody): void => {
    for (const stmt of inner.statements) {
      if (isNamedBodyStatement(stmt) && accepts(stmt.kind)) {
        addName(stmt.name);
      } else if (stmt.kind === 'return' || stmt.kind === 'for') {
        collect(stmt.body);
      } else if (stmt.kind === 'if') {
        collect(stmt.then);
        if (stmt.else) collect(stmt.else);
      }
    }
  };
  collect(body);
  return names;
}

/**
 * Returns whether the input meets the `named body statement` condition.
 */
function isNamedBodyStatement(
  stmt: ComponentStatement,
): stmt is NamedBodyStatement {
  return (
    stmt.kind === 'sketch' ||
    stmt.kind === 'surface' ||
    stmt.kind === 'path' ||
    stmt.kind === 'obj' ||
    stmt.kind === 'objCall' ||
    stmt.kind === 'refObj'
  );
}
