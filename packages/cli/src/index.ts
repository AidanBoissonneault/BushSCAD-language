#!/usr/bin/env node

/**
 * @author Aidan Boissonneault
 * @file index.ts
 * @purpose Public entry point for cli package.
 * @last-edited October 6, 2026
 */

/**
 * CLI entrypoint.
 *
 * Delegates to CLI or service mode based on parsed args.
 */

import { parseArgs, usage } from './commands/arguments/parse-args.js';
import { runCli } from './cli/runCli.js';
import { runService } from './service/runService.js';
import { runParallelOcctWorker } from './service/parallel/run-worker.js';

if (process.argv[2] === '--parallel-occt-worker') {
  runParallelOcctWorker().catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
    );
    process.exitCode = 2;
  });
} else {
  const parsed = parseArgs(process.argv.slice(2));

  if ('service' in parsed) {
    runService();
  } else if ('error' in parsed) {
    process.stderr.write(`${parsed.error}\n`);
    process.exitCode = parsed.error === usage() ? 0 : 2;
  } else {
    runCli(parsed)
      .then((code) => {
        process.exitCode = code;
      })
      .catch((error) => {
        process.stderr.write(
          `${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
        );
        process.exitCode = 2;
      });
  }
}
