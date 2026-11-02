/**
 * @author Aidan Boissonneault
 * @file parse-names.ts
 * @purpose Parses names for the expressions in parser package.
 * @last-edited October 6, 2026
 */

import type { Parser } from '../core/parser.js';
import type { Token, TokenKind } from '../core/token-types.js';

const NON_NAME_TOKEN_KINDS = new Set<TokenKind>([
  'NUMBER',
  'STRING',
  'BOOL',
  'UNIT_MM',
  'UNIT_CM',
  'UNIT_M',
  'UNIT_IN',
  'UNIT_FT',
  'UNIT_DEG',
  'PLUS',
  'MINUS',
  'STAR',
  'SLASH',
  'PERCENT',
  'AMPERSAND',
  'EQ',
  'NEQ',
  'LT',
  'GT',
  'LTE',
  'GTE',
  'AND',
  'OR',
  'BANG',
  'ASSIGN',
  'QUESTION',
  'COLON',
  'SEMICOLON',
  'DOT',
  'COMMA',
  'LPAREN',
  'RPAREN',
  'LBRACE',
  'RBRACE',
  'LBRACKET',
  'RBRACKET',
  'EOF',
  'UNKNOWN',
]);

/**
 * Detects tokens that can act as names in contextual parser positions.
 * The lexer promotes words like `sweep`, `path`, and `offset` to keyword tokens,
 * but those words are still valid names when grammar context expects a label.
 */
export function isNameToken(token: Token): boolean {
  return !NON_NAME_TOKEN_KINDS.has(token.kind);
}

/**
 * Reads a contextual name token while preserving its original text value.
 * Keyword collisions should be handled locally in name positions instead of
 * weakening operation parsing or changing the token stream globally.
 */
export function expectName(p: Parser, msg = 'Expected identifier'): Token {
  if (isNameToken(p.peek())) return p.advance();
  const t = p.peek();
  p.addError(`${msg}, got ${t.kind}('${t.value}')`, t.span);
  return { kind: 'IDENT', value: '', span: t.span };
}

/**
 * Reads an object target name with optional array indexing syntax.
 * Object-level operations keep target fields as strings, so `name[index]`
 * is preserved compactly and interpreted by the evaluator against generated
 * object arrays.
 */
export function parseObjectTargetName(p: Parser): string {
  let target = p.expect('IDENT').value;
  if (p.check('LBRACKET') && p.peek(1).kind === 'NUMBER') {
    p.advance();
    const index = p.expect(
      'NUMBER',
      'Expected numeric object array index',
    ).value;
    p.expect('RBRACKET');
    target += `[${Math.trunc(Number(index))}]`;
  }
  return target;
}
