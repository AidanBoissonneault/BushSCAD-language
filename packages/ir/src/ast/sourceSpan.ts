/**
 * @author Aidan Boissonneault
 * @file sourceSpan.ts
 * @purpose Provides source span behavior for the ast in IR package.
 * @last-edited October 6, 2026
 */

/**
 * Identifies the original source range for an AST node.
 * Every parser output keeps source positions so later compiler stages can report
 * precise diagnostics without needing access to parser internals.
 */
export type ASTSourceSpan = {
  file: string;
  line: number;
  col: number;
  endLine: number;
  endCol: number;
};
