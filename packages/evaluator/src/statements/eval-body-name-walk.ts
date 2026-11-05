/**
 * @author Aidan Boissonneault
 * @file eval-body-name-walk.ts
 * @purpose Evaluates static body-name facts for evaluator statement analysis.
 * @last-edited October 6, 2026
 */

import type { ComponentBody, ComponentStatement } from '@bushscad/ir';
import type { BodyNameFacts } from '../core/eval-types.js';

/** Accepted declaration kinds that can own a local body name. */
type NamedBodyKind =
  'sketch' | 'surface' | 'path' | 'obj' | 'objCall' | 'refObj';

/** Selected members of `ComponentStatement` used by the name walk. */
type NamedBodyStatement = Extract<ComponentStatement, { kind: NamedBodyKind }>;

/** Collects both static name lists once and memoizes them for this evaluation. */
export function analyzeBodyNames(
  body: ComponentBody,
  cache: WeakMap<ComponentBody, BodyNameFacts>,
): BodyNameFacts {
  const cached = cache.get(body);
  if (cached) return cached;

  const localNames: string[] = [];
  const objectNames: string[] = [];
  const seenLocalNames = new Set<string>();
  const seenObjectNames = new Set<string>();
  const addName = (name: string, values: string[], seen: Set<string>): void => {
    if (seen.has(name)) return;
    seen.add(name);
    values.push(name);
  };

  /** Visits nested statement bodies in the same source order as evaluation. */
  const collect = (inner: ComponentBody): void => {
    for (const stmt of inner.statements) {
      if (isNamedBodyStatement(stmt)) {
        addName(stmt.name, localNames, seenLocalNames);
        if (isObjectBodyStatement(stmt)) {
          addName(stmt.name, objectNames, seenObjectNames);
        }
      } else if (stmt.kind === 'return' || stmt.kind === 'for') {
        collect(stmt.body);
      } else if (stmt.kind === 'if') {
        collect(stmt.then);
        if (stmt.else) collect(stmt.else);
      }
    }
  };
  collect(body);

  const facts = {
    localNames: Object.freeze(localNames),
    objectNames: Object.freeze(objectNames),
  };
  cache.set(body, facts);
  return facts;
}

/** Narrows a statement to the declarations that contribute a local name. */
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

/** Narrows a named declaration to one that produces a concrete object. */
function isObjectBodyStatement(
  stmt: NamedBodyStatement,
): stmt is Extract<NamedBodyStatement, { kind: 'obj' | 'objCall' | 'refObj' }> {
  return (
    stmt.kind === 'obj' || stmt.kind === 'objCall' || stmt.kind === 'refObj'
  );
}
