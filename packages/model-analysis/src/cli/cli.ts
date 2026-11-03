#!/usr/bin/env node

/**
 * @author Aidan Boissonneault
 * @file cli.ts
 * @purpose Starts the model-analysis command-line application.
 * @last-edited November 3, 2026
 */

import { parseArgs } from './cliArgs.js';
import { runModelAnalysisCommand } from './command-runner.js';

const command = parseArgs(process.argv.slice(2));

runModelAnalysisCommand(command)
  .then((code) => process.exit(code))
  .catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? error.stack : String(error)}\n`,
    );
    process.exit(2);
  });
