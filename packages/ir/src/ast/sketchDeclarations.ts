/**
 * @author Aidan Boissonneault
 * @file sketchDeclarations.ts
 * @purpose Provides sketch declarations behavior for the ast in IR package.
 * @last-edited October 6, 2026
 */

import type {
  Program,
  SketchDecl,
  TopLevelStatement,
} from './declarations.js';
import type { ComponentBody, ComponentStatement } from './statements/body.js';
import type { ASTSourceSpan } from './sourceSpan.js';

/** A sketch declaration together with its ownership and immediate lexical scope. */
export type SketchDeclarationLocation = {
  sketch: SketchDecl;
  componentPath: string[];
  scopeSpan: ASTSourceSpan | null;
};

/**
 * Collects every sketch declaration in source order.
 * Editor features need one authoritative traversal for top-level, exported,
 * component, function, loop, return, and conditional sketch declarations.
 */
export function collectSketchDeclarations(
  program: Program,
): SketchDeclarationLocation[] {
  const sketches: SketchDeclarationLocation[] = [];
  for (const statement of program.statements) {
    collectTopLevelStatement(statement, sketches, []);
  }
  return sketches;
}

/** Traverses a top-level declaration without losing its component ownership. */
function collectTopLevelStatement(
  statement: TopLevelStatement,
  sketches: SketchDeclarationLocation[],
  componentPath: string[],
): void {
  switch (statement.kind) {
    case 'sketch':
      sketches.push({ sketch: statement, componentPath, scopeSpan: null });
      break;
    case 'part':
    case 'refPart':
    case 'fn':
      collectComponentBody(statement.body, sketches, [
        ...componentPath,
        statement.name,
      ]);
      break;
    case 'export':
      collectTopLevelStatement(statement.statement, sketches, componentPath);
      break;
  }
}

/** Traverses statements held by a component-like declaration. */
function collectComponentBody(
  body: ComponentBody,
  sketches: SketchDeclarationLocation[],
  componentPath: string[],
): void {
  for (const statement of body.statements) {
    collectComponentStatement(statement, sketches, componentPath, body.span);
  }
}

/** Traverses the nested statement forms that can contain sketches. */
function collectComponentStatement(
  statement: ComponentStatement,
  sketches: SketchDeclarationLocation[],
  componentPath: string[],
  scopeSpan: ASTSourceSpan,
): void {
  switch (statement.kind) {
    case 'sketch':
      sketches.push({ sketch: statement, componentPath, scopeSpan });
      break;
    case 'refPart':
    case 'fn':
      collectComponentBody(statement.body, sketches, [
        ...componentPath,
        statement.name,
      ]);
      break;
    case 'return':
    case 'for':
      collectComponentBody(statement.body, sketches, componentPath);
      break;
    case 'if':
      collectComponentBody(statement.then, sketches, componentPath);
      if (statement.else)
        collectComponentBody(statement.else, sketches, componentPath);
      break;
  }
}
