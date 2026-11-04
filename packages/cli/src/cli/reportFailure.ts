/**
 * @author Aidan Boissonneault
 * @file reportFailure.ts
 * @purpose Provides report failure behavior for the cli in cli package.
 * @last-edited October 6, 2026
 */

import type { CompileError } from '@bushscad/ir';
import type { CliOptions } from '../commands/arguments/types.js';
import { stringifyCliResult } from '../dto/json.js';
import { printErrors } from './printErrors.js';

/** Reports a failed compile result as JSON or human text and returns exit code 1. */
export function reportFailure<T extends { ok: false; errors: CompileError[] }>(
  result: T,
  options: CliOptions,
): number {
  if (options.json) {
    process.stdout.write(`${stringifyCliResult(result)}\n`);
  } else {
    printErrors(result.errors);
  }
  return 1;
}
