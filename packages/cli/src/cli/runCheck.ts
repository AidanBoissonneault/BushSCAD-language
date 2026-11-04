/**
 * @author Aidan Boissonneault
 * @file runCheck.ts
 * @purpose Provides run check behavior for the cli in cli package.
 * @last-edited October 6, 2026
 */

import { compileFileToIr } from '@bushscad/compiler/node';
import type { CliOptions } from '../commands/arguments/types.js';
import { reportFailure } from './reportFailure.js';

/** Runs `bushscad --check` and writes the requested text or JSON result. */
export function runCheck(options: CliOptions): number {
  const result = compileFileToIr({
    filePath: options.filePath,
    env: options.env,
  });

  if (!result.ok) return reportFailure(result, options);

  if (options.json) {
    process.stdout.write(
      `${JSON.stringify({
        ok: true,
        env: result.env,
        elapsedMs: result.elapsedMs,
      })}\n`,
    );
  } else {
    process.stdout.write(
      `OK ${options.filePath} (${result.elapsedMs.toFixed(0)}ms)\n`,
    );
  }

  return 0;
}
