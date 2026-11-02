/**
 * @author Aidan Boissonneault
 * @file errors.ts
 * @purpose Provides errors behavior for the core in compiler package.
 * @last-edited October 6, 2026
 */

import type { CompileError, SourceSpan } from '@bushscad/ir';

/**
 * Converts parser and resolver style errors into compiler errors.
 * The compiler package exposes one error shape regardless of which pipeline
 * stage produced the failure.
 */
export function toCompileErrors(
  errors: { message: string; span: SourceSpan }[],
): CompileError[] {
  return errors.map((error) => ({
    message: error.message,
    span: {
      file: error.span.file,
      line: error.span.line,
      col: error.span.col,
    },
  }));
}
