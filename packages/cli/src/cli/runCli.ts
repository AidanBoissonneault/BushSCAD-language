/**
 * @author Aidan Boissonneault
 * @file runCli.ts
 * @purpose Provides run cli behavior for the cli in cli package.
 * @last-edited October 6, 2026
 */

import type { CliOptions } from '../commands/args.js';
import { runBuild } from './runBuild.js';
import { runCheck } from './runCheck.js';
import { runExport } from './runExport.js';

/**
 * Runs cli and returns its result.
 */
export async function runCli(options: CliOptions): Promise<number> {
  if (options.check) return runCheck(options);
  if (options.build) return runBuild(options);
  return runExport(options);
}
