/**
 * @author Aidan Boissonneault
 * @file parse-patterns.ts
 * @purpose Parses patterns for the objects in parser package.
 * @last-edited October 6, 2026
 */

import type { PatternLinearStmt, PatternRadialStmt } from '@bushscad/ir';
import type { Parser } from '../core/parser.js';
import { parsePatternCallArgs } from './parse-pattern-call.js';

/**
 * Parses pattern from the supplied source into the objects representation.
 */
export function parsePattern(p: Parser): PatternLinearStmt | PatternRadialStmt {
  const start = p.peek().span;
  p.advance(); // PATTERN
  p.expect('LPAREN', 'pattern syntax is pattern(target, linear|radial, ...)');
  const args = parsePatternCallArgs(p, start);
  p.expect('RPAREN');
  p.eatSemi();
  return args;
}
