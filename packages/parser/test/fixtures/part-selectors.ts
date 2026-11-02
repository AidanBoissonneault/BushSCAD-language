/**
 * @author Aidan Boissonneault
 * @file part-selectors.ts
 * @purpose Tests part selectors behavior in the fixtures in parser package.
 * @last-edited October 6, 2026
 */

import type { PartDecl, Program } from '@bushscad/ir';

/**
 * Returns a named part declaration from a parsed program.
 *
 * Tests use this to make AST lookup failures explicit and consistent.
 */
export function part(ast: Program, name: string): PartDecl {
  const s = ast.statements.find((s) => s.kind === 'part' && s.name === name);
  if (!s) throw new Error(`Part '${name}' not found`);
  return s as PartDecl;
}
