/**
 * @author Aidan Boissonneault
 * @file lexer-position.ts
 * @purpose Tracks source offsets, lines, and columns while the lexer scans a document.
 * @last-edited October 6, 2026
 */

/**
 * Lexer mark, including pos, source line, and source column.
 */

export type LexerMark = {
  pos: number;
  line: number;
  col: number;
};
