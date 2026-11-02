/**
 * @author Aidan Boissonneault
 * @file workspace-errors.ts
 * @purpose Provides workspace errors behavior for the workspace in compiler package.
 * @last-edited October 6, 2026
 */

import type { CompileError, SourceSpan } from '@bushscad/ir';

/**
 * Handles span in the workspace flow.
 */
function span(file: string): SourceSpan {
  return { file, line: 1, col: 1 };
}

/**
 * Constructs error from the supplied values.
 */
export function makeError(file: string, message: string): CompileError {
  return { message, span: span(file) };
}
