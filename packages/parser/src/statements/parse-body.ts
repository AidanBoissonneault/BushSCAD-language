/**
 * @author Aidan Boissonneault
 * @file parse-body.ts
 * @purpose Parses body for the statements in parser package.
 * @last-edited October 6, 2026
 */

import { ParseRecovery } from '../core/errors.js';
import type { ComponentBody, ComponentStatement } from '@bushscad/ir';
import type { Parser } from '../core/parser.js';
import { parseComponentStatement } from './parse-component-statement.js';

export { parseTopLevelStatement } from './parse-top-level-statement.js';

const RETURN_ENTRY_START_TOKENS = new Set<string>([
  'VAR',
  'ENV',
  'USE',
  'SKETCH',
  'SURFACE',
  'PATH',
  'OBJ',
  'REF',
  'PART',
  'FN',
  'FOR',
  'IF',
  'RETURN',
  'FILLET',
  'CHAMFER',
  'SHELL',
  'DRAFT',
  'THREAD',
  'ANCHOR',
  'PLANE',
  'ROTATE',
  'COLOR',
  'MATERIAL',
  'PLACE',
  'PATTERN',
  'MIRROR',
  'TRANSFORM',
  'ASSERT',
  'FIT',
  'THIS',
  'AT_SIGN',
]);

/**
 * Parses component body from the supplied source into the statements representation.
 */
export function parseComponentBody(p: Parser): ComponentBody {
  const start = p.peek().span;
  p.expect('LBRACE');
  const statements: ComponentStatement[] = [];
  const prev = p.allowStatementSemicolons;
  p.allowStatementSemicolons = true;
  try {
    while (!p.check('RBRACE', 'EOF')) {
      try {
        const stmt = parseComponentStatement(p);
        if (stmt) statements.push(stmt);
      } catch (e) {
        if (e instanceof ParseRecovery) {
          p.recoverToStatement();
          continue;
        }
        throw e;
      }
    }
  } finally {
    p.allowStatementSemicolons = prev;
  }
  p.expect('RBRACE');
  return { statements, span: p.spanFrom(start) };
}

/**
 * Synchronizes to return entry with its current source.
 */
function syncToReturnEntry(p: Parser): void {
  while (!p.check('EOF', 'RBRACE')) {
    if (p.eat('COMMA')) return;
    if (p.eat('SEMICOLON')) return;
    if (isReturnEntryStart(p)) return;
    p.advance();
  }
}

/**
 * Returns whether the input meets the `return entry start` condition.
 */
function isReturnEntryStart(p: Parser): boolean {
  const k = p.peek().kind;
  if (RETURN_ENTRY_START_TOKENS.has(k)) return true;
  return (
    k === 'IDENT' &&
    ((p.peek(1).kind === 'IDENT' && p.peek(2).kind === 'LPAREN') ||
      p.peek(1).kind === 'ASSIGN' ||
      p.peek(1).kind === 'DOT' ||
      p.peek(1).kind === 'LPAREN')
  );
}

/**
 * Parses return body from the supplied source into the statements representation.
 */
export function parseReturnBody(p: Parser): ComponentBody {
  const start = p.peek().span;
  p.expect('LBRACE');
  const statements: ComponentStatement[] = [];
  const prev = p.allowStatementSemicolons;
  p.allowStatementSemicolons = false;
  try {
    while (!p.check('RBRACE', 'EOF')) {
      try {
        const stmt = parseComponentStatement(p);
        if (stmt) statements.push(stmt);

        if (p.eat('COMMA')) continue;
        if (p.check('RBRACE', 'EOF')) continue;
        const semi = p.eat('SEMICOLON');
        if (semi) {
          p.addError(
            `Expected ',' between return entries; semicolons are not allowed inside return blocks`,
            semi.span,
          );
          continue;
        }
        p.addError(`Expected ',' between return entries`, p.peek().span);
      } catch (e) {
        if (e instanceof ParseRecovery) {
          syncToReturnEntry(p);
          continue;
        }
        throw e;
      }
    }
  } finally {
    p.allowStatementSemicolons = prev;
  }
  p.expect('RBRACE');
  return { statements, span: p.spanFrom(start) };
}
