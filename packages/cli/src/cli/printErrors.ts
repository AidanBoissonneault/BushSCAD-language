/**
 * @author Aidan Boissonneault
 * @file printErrors.ts
 * @purpose Provides print errors behavior for the cli in cli package.
 * @last-edited October 6, 2026
 */

import type { CompileError } from '@bushscad/ir';

/**
 * Prints compile errors in CLI-friendly format.
 */
export function printErrors(errors: CompileError[]): void {
  for (const error of errors) {
    process.stderr.write(
      `${error.span.file}:${error.span.line}:${error.span.col}: ${error.message}\n`,
    );
  }
}
