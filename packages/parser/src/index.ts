/**
 * @author Aidan Boissonneault
 * @file index.ts
 * @purpose Public entry point for parser package.
 * @last-edited October 6, 2026
 */

export { parse } from './core/parser.js';
export { tokenize } from './core/lexer.js';
export type { Token, TokenKind } from './core/lexer.js';
export type { ParseResult } from './core/parser.js';
export type { ParseError } from './core/errors.js';
