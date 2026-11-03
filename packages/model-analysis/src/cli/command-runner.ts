/**
 * @author Aidan Boissonneault
 * @file command-runner.ts
 * @purpose Routes model-analysis commands to their application actions.
 * @last-edited November 3, 2026
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

/** Runs the parsed model-analysis command and returns its process exit code. */
export async function runModelAnalysisCommand(
  command: ReturnType<typeof parseArgs>,
): Promise<number> {
  if (command.kind === 'error') {
    return handleErrorCommand(command.message);
  }
  if (command.kind === 'analyze') return handleAnalyzeCommand(command);
  if (command.kind === 'baseline') return handleBaselineCommand(command);
  if (command.kind === 'suite') return handleSuiteCommand(command);
  return handleCompareCommand(command);
}

/** Writes parser errors while treating help usage as a successful invocation. */
function handleErrorCommand(message: string): number {
  process.stderr.write(`${message}\n`);
  return message.startsWith('Usage:') ? 0 : 2;
}

/** Runs model analysis and applies warning failure policy. */
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

/** Writes a named analysis baseline. */
async function handleBaselineCommand(
  command: BaselineCommand,
): Promise<number> {
  const result = await writeBaseline(command);
  output(command.json, result, `Baseline written to ${result.baselinePath}`);
  return 0;
}

/** Compares current model metrics with a stored baseline. */
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

/** Runs the physical model suite and reports its generated PDF. */
async function handleSuiteCommand(command: SuiteCommand): Promise<number> {
  const result = await runLanguageSuite(command);
  output(
    command.json,
    result,
    `${result.ok ? 'Language suite passed' : 'Language suite failed'}: ${result.reportPdfPath}`,
  );
  return result.ok ? 0 : 1;
}

/** Writes either compact JSON or the human-readable command summary. */
function output(json: boolean, value: unknown, text: string): void {
  if (json) {
    process.stdout.write(`${JSON.stringify(serializable(value), null, 2)}\n`);
  } else {
    process.stdout.write(`${text}\n`);
  }
}

/** Converts success and configured warning policies into CLI status codes. */
function exitCode(ok: boolean, warningFailure: boolean): number {
  if (!ok) return 1;
  return warningFailure ? 1 : 0;
}

/** Detects non-zero comparison metrics that the CLI treats as warnings. */
function hasComparisonWarnings(
  comparisons: { triangleDelta: number; issueDeltas: Record<string, number> }[],
): boolean {
  return comparisons.some(
    (comparison) =>
      comparison.triangleDelta !== 0 ||
      Object.values(comparison.issueDeltas).some((value) => value !== 0),
  );
}
