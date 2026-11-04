/**
 * @author Aidan Boissonneault
 * @file cliArgs.ts
 * @purpose Parses model-analysis CLI arguments and dispatches commands.
 * @last-edited October 6, 2026
 */

export type {
  AnalyzeCommand,
  BaselineCommand,
  CompareCommand,
  SuiteCommand,
} from './types.js';
import type { CommonArgs, ParsedCommand } from './types.js';
import { parseAnalyze } from './commands/analyze/parse-analyze-command.js';
import { parseBaseline } from './commands/baseline/parse-baseline-command.js';
import { parseCompare } from './commands/compare/parse-compare-command.js';
import { parseSuite } from './commands/suite/parse-suite-command.js';

/**
 * Handles usage in the cli flow.
 */
function usage(): string {
  return [
    'Usage:',
    '  bushscad-analyze-model analyze <file.bscd> --out <dir>',
    '  bushscad-analyze-model baseline <file.bscd> --name <name>',
    '  bushscad-analyze-model compare <file.bscd> --baseline <name> --out <dir>',
    '  bushscad-analyze-model suite <examples/test_suite> --out <dir>',
  ].join('\n');
}

/**
 * Parses the model-analysis CLI arguments.
 * The analyzer is intended for repeatable debugging runs, so invalid command
 * lines should fail before expensive OCCT initialization starts.
 */
export function parseArgs(args: string[]): ParsedCommand {
  const command = args[0];
  if (!command || command === '--help' || command === '-h')
    return { kind: 'error', message: usage() };
  if (
    command !== 'analyze' &&
    command !== 'baseline' &&
    command !== 'compare' &&
    command !== 'suite'
  )
    return {
      kind: 'error',
      message: `Unknown command '${command}'\n\n${usage()}`,
    };
  const parsed = parseCommon(args.slice(1));
  if ('message' in parsed) return { kind: 'error', message: parsed.message };
  if (command === 'analyze') return parseAnalyze(parsed);
  if (command === 'baseline') return parseBaseline(parsed);
  if (command === 'suite') return parseSuite(parsed);
  return parseCompare(parsed);
}

/**
 * Parses common from the supplied source into the cli representation.
 */
function parseCommon(args: string[]): CommonArgs | { message: string } {
  const result: CommonArgs = {
    filePath: '',
    outDir: null,
    name: null,
    baseline: null,
    env: {},
    width: 1280,
    height: 900,
    json: false,
    failOnWarning: false,
  };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    const handled = readOption(args, i, arg, result);
    if (typeof handled === 'string') return { message: handled };
    if (handled !== null) {
      i = handled;
      continue;
    }
    if (arg.startsWith('-')) return { message: `Unknown option '${arg}'` };
    if (result.filePath)
      return { message: `Unexpected extra argument '${arg}'` };
    result.filePath = arg;
  }
  if (!result.filePath) return { message: 'Missing file path' };
  return result;
}

/**
 * Reads option from the supplied source.
 */
function readOption(
  args: string[],
  index: number,
  arg: string,
  result: CommonArgs,
): number | string | null {
  if (arg === '--json') {
    result.json = true;
    return index;
  }
  if (arg === '--fail-on-warning') {
    result.failOnWarning = true;
    return index;
  }
  return readValueOption(args, index, arg, result);
}

/**
 * Reads value option from the supplied source.
 */
function readValueOption(
  args: string[],
  index: number,
  arg: string,
  result: CommonArgs,
): number | string | null {
  const value = optionValue(args, index, arg);
  if (!value) return null;
  const [name, raw, nextIndex] = value;
  if (!raw) return `${name} requires a value`;
  const error = applyValueOption(name, raw, result);
  if (error) return error;
  return nextIndex;
}

const VALUE_OPTION_HANDLERS: Record<
  string,
  (raw: string, result: CommonArgs) => string | null
> = {
  '--out': (raw, result) => assignOption(result, 'outDir', raw),
  '--name': (raw, result) => assignOption(result, 'name', raw),
  '--baseline': (raw, result) => assignOption(result, 'baseline', raw),
  '--width': (raw, result) => assignOption(result, 'width', Number(raw)),
  '--height': (raw, result) => assignOption(result, 'height', Number(raw)),
  '--env': applyEnvOption,
};

/**
 * Applies value option to the supplied state or geometry.
 */
function applyValueOption(
  name: string,
  raw: string,
  result: CommonArgs,
): string | null {
  return VALUE_OPTION_HANDLERS[name]?.(raw, result) ?? null;
}

/**
 * Handles assign option in the cli flow.
 */
function assignOption<K extends keyof CommonArgs>(
  result: CommonArgs,
  key: K,
  value: CommonArgs[K],
): null {
  result[key] = value;
  return null;
}

/**
 * Applies env option to the supplied state or geometry.
 */
function applyEnvOption(raw: string, result: CommonArgs): string | null {
  const eq = raw.indexOf('=');
  if (eq <= 0) return '--env requires name=value';
  result.env[raw.slice(0, eq)] = raw.slice(eq + 1);
  return null;
}

/**
 * Handles option value in the cli flow.
 */
function optionValue(
  args: string[],
  index: number,
  arg: string,
): [string, string, number] | null {
  for (const name of [
    '--out',
    '--name',
    '--baseline',
    '--width',
    '--height',
    '--env',
  ]) {
    if (arg === name) return [name, args[index + 1] ?? '', index + 1];
    if (arg.startsWith(`${name}=`))
      return [name, arg.slice(name.length + 1), index];
  }
  return null;
}
