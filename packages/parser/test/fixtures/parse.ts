/**
 * @author Aidan Boissonneault
 * @file parse.ts
 * @purpose Tests parse behavior in the fixtures in parser package.
 * @last-edited October 6, 2026
 */

import type { Program } from '@bushscad/ir';
import { parse } from '../../src/core/parser.js';

/**
 * Parses a BushSCAD source snippet and throws on parse errors.
 *
 * Why:
 * Parser tests usually assert AST shape, so this keeps parse-failure reporting
 * consistent without repeating boilerplate in each test.
 */
export function parseOk(src: string): Program {
  const result = parse(src, 'test.bscd');
  if (result.errors.length > 0) {
    throw new Error(
      `Expected no parse errors: ${result.errors.map((error) => error.message).join('; ')}`,
    );
  }
  return result.ast;
}
