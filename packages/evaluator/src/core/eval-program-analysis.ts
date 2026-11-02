/**
 * @author Aidan Boissonneault
 * @file eval-program-analysis.ts
 * @purpose Evaluates program analysis for the core in evaluator package.
 * @last-edited October 6, 2026
 */

import type { ComponentBody, TopLevelStatement } from '@bushscad/ir';
import type { EvalCtx } from './eval-types.js';

/**
 * Pre-scan the top-level AST to register all component and function names before
 * evaluating any statements. This lets forward-references resolve correctly.
 */
export function registerTopLevelComponents(
  stmt: TopLevelStatement,
  ctx: EvalCtx,
): void {
  if (stmt.kind === 'refPart' && !stmt.extends) {
    ctx.components.set(stmt.name, stmt.body);
    return;
  }
  if (stmt.kind === 'part') {
    ctx.components.set(stmt.name, stmt.body);
    return;
  }
  if (stmt.kind === 'fn') {
    ctx.functions.set(stmt.name, stmt);
    return;
  }

  if (stmt.kind === 'export') {
    registerTopLevelComponents(stmt.statement, ctx);
    return;
  }

  if (stmt.kind === 'import') {
    for (const resolved of stmt.resolved ?? []) {
      registerTopLevelComponents(resolved, ctx);
    }
  }
}

// Env name collection

/**
 * Collects env names from body from the supplied values.
 */
function collectEnvNamesFromBody(
  body: ComponentBody,
  names: Set<string>,
): void {
  for (const stmt of body.statements) {
    if (stmt.kind === 'env') names.add(stmt.name);
    else if (stmt.kind === 'fn' || stmt.kind === 'return') {
      collectEnvNamesFromBody(stmt.body, names);
    } else if (stmt.kind === 'for') {
      collectEnvNamesFromBody(stmt.body, names);
    } else if (stmt.kind === 'if') {
      collectEnvNamesFromBody(stmt.then, names);
      if (stmt.else) collectEnvNamesFromBody(stmt.else, names);
    }
  }
}

/**
 * Collects env names from top level from the supplied values.
 */
export function collectEnvNamesFromTopLevel(
  statements: TopLevelStatement[],
  names = new Set<string>(),
): Set<string> {
  for (const stmt of statements) {
    if (stmt.kind === 'env') names.add(stmt.name);
    else if (stmt.kind === 'part' || stmt.kind === 'fn') {
      collectEnvNamesFromBody(stmt.body, names);
    } else if (stmt.kind === 'export') {
      collectEnvNamesFromTopLevel([stmt.statement], names);
    } else if (stmt.kind === 'import') {
      collectEnvNamesFromTopLevel(stmt.resolved ?? [], names);
    }
  }
  return names;
}
