/**
 * @author Aidan Boissonneault
 * @file json.ts
 * @purpose Provides json behavior for the dto in cli package.
 * @last-edited October 6, 2026
 */

import type { CompileError } from '@bushscad/ir';

/**
 * Result of maybe error, including success flag and errors.
 */
type MaybeErrorResult = {
  ok: boolean;
  errors?: CompileError[];
};

/**
 * Handles plain compile errors in the dto flow.
 */
function plainCompileErrors(errors: CompileError[]): CompileError[] {
  return errors.map((error) => ({
    message: error.message,
    span: error.span,
  }));
}

/**
 * Handles stringify cli result in the dto flow.
 */
export function stringifyCliResult<T extends MaybeErrorResult>(
  result: T,
): string {
  if (result.ok || !result.errors) return JSON.stringify(result);
  return JSON.stringify({
    ...result,
    errors: plainCompileErrors(result.errors),
  });
}
