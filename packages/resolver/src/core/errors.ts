/**
 * @author Aidan Boissonneault
 * @file errors.ts
 * @purpose Provides errors behavior for the core in resolver package.
 * @last-edited October 6, 2026
 */

import type { ASTSourceSpan } from '@bushscad/ir';
import type { State } from './types.js';

/**
 * Adds a resolver diagnostic using the source location shape expected by IR.
 */
export function addError(
  state: State,
  message: string,
  span: ASTSourceSpan,
): void {
  state.errors.push({
    message,
    span: {
      file: span.file,
      line: span.line,
      col: span.col,
      endLine: span.endLine,
      endCol: span.endCol,
    },
  });
}
