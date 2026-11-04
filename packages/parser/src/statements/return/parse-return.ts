/**
 * Parses return statements and their nested component bodies.
 */
import type { ReturnStatement } from '@bushscad/ir';
import type { Parser } from '../../core/parser.js';
/**
 * Parses return from the supplied source into the statements representation.
 */
export function parseReturn(p: Parser): ReturnStatement {
  const start = p.peek().span;
  p.advance(); // RETURN
  const body = p.parseReturnBody();
  p.eatSemi();
  return { kind: 'return', body, span: p.spanFrom(start) };
}
