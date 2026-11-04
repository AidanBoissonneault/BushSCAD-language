/**
 * Parses a function invocation used as a component statement.
 */
import type { CallStatement } from '@bushscad/ir';
import type { Parser } from '../../core/parser.js';
/**
 * Parses call statement from the supplied source into the statements representation.
 */
export function parseCallStatement(p: Parser): CallStatement {
  const start = p.peek().span;
  const name = p.expect('IDENT');
  const call = p.parseFnCallFromIdent(name);
  p.eatSemi();
  return { kind: 'callStmt', call, span: p.spanFrom(start) };
}
