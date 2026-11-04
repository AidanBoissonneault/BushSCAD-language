/**
 * Parses conditional component statements.
 */
import type { ComponentBody, IfStatement } from '@bushscad/ir';
import type { Parser } from '../../core/parser.js';
/**
 * Parses if from the supplied source into the statements representation.
 */
export function parseIf(p: Parser): IfStatement {
  const start = p.peek().span;
  p.advance(); // IF
  const condition = p.parseExpr();
  const then = p.parseComponentBody();
  const else_: ComponentBody | null = p.eat('ELSE')
    ? p.parseComponentBody()
    : null;
  return { kind: 'if', condition, then, else: else_, span: p.spanFrom(start) };
}
