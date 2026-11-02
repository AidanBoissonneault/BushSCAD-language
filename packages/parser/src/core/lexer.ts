/**
 * @author Aidan Boissonneault
 * @file lexer.ts
 * @purpose Provides lexer behavior for the core in parser package.
 * @last-edited October 6, 2026
 */

import type { Token } from './token-types.js';
import { LexerCursor } from './lexer-cursor.js';

export type { TokenKind, Token } from './token-types.js';

/** Tokenizes BushSCAD source text and includes the terminating EOF token. */
export function tokenize(source: string, file: string): Token[] {
  return new LexerCursor(source, file).tokenize();
}
