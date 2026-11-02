/**
 * @author Aidan Boissonneault
 * @file cliArgs.ts
 * @purpose Defines model-analysis CLI commands and parses their arguments.
 * @last-edited October 6, 2026
 */

/**
 * Analyze command, including operation kind, source file path, out dir, env, and width.
 */

export type AnalyzeCommand = {
  kind: 'analyze';
  filePath: string;
  outDir: string;
  env: Record<string, string>;
  width: number;
  height: number;
  json: boolean;
  failOnWarning: boolean;
};

/**
 * Baseline command, including operation kind, source file path, name, env, and width.
 */
export type BaselineCommand = {
  kind: 'baseline';
  filePath: string;
  name: string;
  env: Record<string, string>;
  width: number;
  height: number;
  json: boolean;
};

/**
 * Compare command, including operation kind, source file path, baseline, out dir, and env.
 */
export type CompareCommand = {
  kind: 'compare';
  filePath: string;
  baseline: string;
  outDir: string;
  env: Record<string, string>;
  width: number;
  height: number;
  json: boolean;
  failOnWarning: boolean;
};

/**
 * Suite command, including operation kind, suite root, out dir, width, and height.
 */
export type SuiteCommand = {
  kind: 'suite';
  suiteRoot: string;
  outDir: string;
  width: number;
  height: number;
  json: boolean;
};

/**
 * Parsed command accepts AnalyzeCommand, BaselineCommand, CompareCommand, SuiteCommand, and {
 * kind: 'error'; message: string }.
 */
type ParsedCommand =
  | AnalyzeCommand
  | BaselineCommand
  | CompareCommand
  | SuiteCommand
  | { kind: 'error'; message: string };

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
 * Common args, including source file path, out dir, name, baseline, and env.
 */
type CommonArgs = {
  filePath: string;
  outDir: string | null;
  name: string | null;
  baseline: string | null;
  env: Record<string, string>;
  width: number;
  height: number;
  json: boolean;
  failOnWarning: boolean;
};

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

/**
 * Parses analyze from the supplied source into the cli representation.
 */
function parseAnalyze(args: CommonArgs): ParsedCommand {
  if (!args.outDir)
    return { kind: 'error', message: 'analyze requires --out <dir>' };
  return {
    kind: 'analyze',
    filePath: args.filePath,
    outDir: args.outDir,
    env: args.env,
    width: args.width,
    height: args.height,
    json: args.json,
    failOnWarning: args.failOnWarning,
  };
}

/**
 * Parses baseline from the supplied source into the cli representation.
 */
function parseBaseline(args: CommonArgs): ParsedCommand {
  if (!args.name)
    return { kind: 'error', message: 'baseline requires --name <name>' };
  return {
    kind: 'baseline',
    filePath: args.filePath,
    name: args.name,
    env: args.env,
    width: args.width,
    height: args.height,
    json: args.json,
  };
}

/**
 * Parses compare from the supplied source into the cli representation.
 */
function parseCompare(args: CommonArgs): ParsedCommand {
  if (!args.baseline)
    return { kind: 'error', message: 'compare requires --baseline <name>' };
  if (!args.outDir)
    return { kind: 'error', message: 'compare requires --out <dir>' };
  return {
    kind: 'compare',
    filePath: args.filePath,
    baseline: args.baseline,
    outDir: args.outDir,
    env: args.env,
    width: args.width,
    height: args.height,
    json: args.json,
    failOnWarning: args.failOnWarning,
  };
}

/**
 * Parses suite from the supplied source into the cli representation.
 */
function parseSuite(args: CommonArgs): ParsedCommand {
  if (!args.outDir)
    return { kind: 'error', message: 'suite requires --out <dir>' };
  return {
    kind: 'suite',
    suiteRoot: args.filePath,
    outDir: args.outDir,
    width: args.width,
    height: args.height,
    json: args.json,
  };
}
