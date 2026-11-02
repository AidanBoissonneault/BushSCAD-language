#!/usr/bin/env node

/**
 * @author Aidan Boissonneault
 * @file cli.ts
 * @purpose Provides cli behavior for the cli in model analysis package.
 * @last-edited October 6, 2026
 */

import { analyzeModel } from '../analysis/modelAnalysis.js';
import { writeBaseline } from '../comparison/baselines.js';
import { compareModel } from '../comparison/compare.js';
import { runLanguageSuite } from '../suite/runSuite.js';
import {
  parseArgs,
  type AnalyzeCommand,
  type BaselineCommand,
  type CompareCommand,
  type SuiteCommand,
} from './cliArgs.js';
import {
  compactAnalysis,
  compactComparison,
  serializable,
} from '../reporting/json.js';

const command = parseArgs(process.argv.slice(2));

run()
  .then((code) => process.exit(code))
  .catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? error.stack : String(error)}\n`,
    );
    process.exit(2);
  });

/**
 * Runs and returns its result.
 */
async function run(): Promise<number> {
  if (command.kind === 'error') {
    return handleErrorCommand(command.message);
  }
  if (command.kind === 'analyze') return handleAnalyzeCommand(command);
  if (command.kind === 'baseline') return handleBaselineCommand(command);
  if (command.kind === 'suite') return handleSuiteCommand(command);
  return handleCompareCommand(command);
}

/**
 * Handles error command in the current cli flow.
 */
function handleErrorCommand(message: string): number {
  process.stderr.write(`${message}\n`);
  return message.startsWith('Usage:') ? 0 : 2;
}

/**
 * Handles analyze command in the current cli flow.
 */
async function handleAnalyzeCommand(command: AnalyzeCommand): Promise<number> {
  const result = await analyzeModel(command);
  output(
    command.json,
    compactAnalysis(result),
    result.ok ? `Analysis written to ${command.outDir}` : 'Analysis failed',
  );
  return exitCode(
    result.ok,
    command.failOnWarning && result.ok && result.warnings.length > 0,
  );
}

/**
 * Handles baseline command in the current cli flow.
 */
async function handleBaselineCommand(
  command: BaselineCommand,
): Promise<number> {
  const result = await writeBaseline(command);
  output(command.json, result, `Baseline written to ${result.baselinePath}`);
  return 0;
}

/**
 * Handles compare command in the current cli flow.
 */
async function handleCompareCommand(command: CompareCommand): Promise<number> {
  const result = await compareModel(command);
  output(
    command.json,
    compactComparison(result),
    result.ok ? `Comparison written to ${command.outDir}` : 'Comparison failed',
  );
  return exitCode(
    result.ok,
    command.failOnWarning &&
      result.ok &&
      hasComparisonWarnings(result.comparisons),
  );
}

/**
 * Handles suite command in the current cli flow.
 */
async function handleSuiteCommand(command: SuiteCommand): Promise<number> {
  const result = await runLanguageSuite(command);
  output(
    command.json,
    result,
    `${result.ok ? 'Language suite passed' : 'Language suite failed'}: ${result.reportPdfPath}`,
  );
  return result.ok ? 0 : 1;
}

/**
 * Handles output in the cli flow.
 */
function output(json: boolean, value: unknown, text: string): void {
  if (json) {
    process.stdout.write(`${JSON.stringify(serializable(value), null, 2)}\n`);
  } else {
    process.stdout.write(`${text}\n`);
  }
}

/**
 * Handles exit code in the cli flow.
 */
function exitCode(ok: boolean, warningFailure: boolean): number {
  if (!ok) return 1;
  return warningFailure ? 1 : 0;
}

/**
 * Checks whether the input has comparison warnings.
 */
function hasComparisonWarnings(
  comparisons: { triangleDelta: number; issueDeltas: Record<string, number> }[],
): boolean {
  return comparisons.some(
    (comparison) =>
      comparison.triangleDelta !== 0 ||
      Object.values(comparison.issueDeltas).some((value) => value !== 0),
  );
}
