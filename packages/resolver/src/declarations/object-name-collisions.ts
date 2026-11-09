/** Reports duplicate object-producing names while preserving symbol collection. */

import type {
  ASTSourceSpan,
  ComponentBody,
  ComponentStatement,
} from '@bushscad/ir';
import { addError } from '../core/errors.js';
import type { Scope } from '../core/scope.js';
import type { State } from '../core/types.js';

/**
 * Registers an object output or placed instance in its lexical scope.
 *
 * Why:
 * Face and edge selectors use object names as geometry owners, so two outputs
 * with one name would make selectors ambiguous. Keeping this check in the
 * resolver surfaces the problem before geometry compilation begins.
 */
export function defineObjectName(
  name: string,
  span: ASTSourceSpan,
  scope: Scope,
  state: State,
): void {
  if (!scope.defineObject(name)) {
    reportDuplicateObjectName(name, span, state);
  }
}

/**
 * Checks object outputs in function bodies, which are resolved lazily at calls.
 *
 * Why:
 * Function declarations need duplicate-name diagnostics even when they are
 * never called. Return blocks share their function's output namespace, while
 * branch and loop bodies keep independent local namespaces.
 */
export function validateFunctionObjectNames(
  body: ComponentBody,
  state: State,
): void {
  validateBodyObjectNames(body, new Set(), state);
}

/** Reports a duplicate name found by either scope collection or body scanning. */
function reportDuplicateObjectName(
  name: string,
  span: ASTSourceSpan,
  state: State,
): void {
  addError(state, `Duplicate object name '${name}'`, span);
}

/** Visits object-producing statements while following the language's scope rules. */
function validateBodyObjectNames(
  body: ComponentBody,
  seen: Set<string>,
  state: State,
): void {
  for (const stmt of body.statements) {
    const declaration = objectNameDeclaration(stmt);
    if (declaration) {
      if (seen.has(declaration.name)) {
        reportDuplicateObjectName(declaration.name, declaration.span, state);
      } else {
        seen.add(declaration.name);
      }
    }

    if (stmt.kind === 'return') {
      validateBodyObjectNames(stmt.body, seen, state);
    } else if (stmt.kind === 'for') {
      validateBodyObjectNames(stmt.body, new Set(), state);
    } else if (stmt.kind === 'if') {
      validateBodyObjectNames(stmt.then, new Set(), state);
      if (stmt.else) validateBodyObjectNames(stmt.else, new Set(), state);
    } else if (stmt.kind === 'fn') {
      validateBodyObjectNames(stmt.body, new Set(), state);
    }
  }
}

/** Returns the object name and source location contributed by one statement. */
function objectNameDeclaration(
  stmt: ComponentStatement,
): { name: string; span: ASTSourceSpan } | null {
  switch (stmt.kind) {
    case 'obj':
    case 'objCall':
    case 'refObj':
      return { name: stmt.name, span: stmt.nameSpan ?? stmt.span };
    case 'place':
      return stmt.as ? { name: stmt.as, span: stmt.span } : null;
    default:
      return null;
  }
}
