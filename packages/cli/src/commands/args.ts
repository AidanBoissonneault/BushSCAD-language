/**
 * @author Aidan Boissonneault
 * @file args.ts
 * @purpose Provides args behavior for the commands in cli package.
 * @last-edited October 6, 2026
 */

import type { ExportFormat } from '@bushscad/ir';

/**
 * Options for cli, including source file path, env, export format, out, and check.
 */
export type CliOptions = {
  filePath: string;
  env: Record<string, string>;
  format: ExportFormat;
  out: string | null;
  check: boolean;
  build: boolean;
  json: boolean;
};

/**
 * Parsed args accepts CliOptions, { service: true }, and { error: string }.
 */
type ParsedArgs = CliOptions | { service: true } | { error: string };

/**
 * Result of arg handler accepts { handled: true; index: number; error?: string } and { handled:
 * false }.
 */
type ArgHandlerResult =
  | { handled: true; index: number; error?: string }
  | { handled: false };

/**
 * Handles usage in the commands flow.
 */
export function usage(): string {
  return [
    'Usage: bushscad <file.bscd> [--env name=value ...] [--out path] [--format step|stl] [--check] [--build] [--json]',
    '',
    'Examples:',
    '  bushscad model.bscd',
    '  bushscad model.bscd --env build_mode=release --env hole_count=8',
    '  bushscad model.bscd --check --json',
    '  bushscad model.bscd --build',
  ].join('\n');
}

/**
 * Parses args from the supplied source into the commands representation.
 */
export function parseArgs(args: string[]): ParsedArgs {
  if (args[0] === '--service') return { service: true };

  const options = defaultOptions();
  for (let i = 0; i < args.length; i++) {
    const result = handleArg(args, i, options);
    if (!result.handled) return { error: `Unexpected parser state at ${i}` };
    if (result.error) return { error: result.error };
    i = result.index;
  }

  if (!options.filePath) return { error: usage() };
  return options;
}

/**
 * Returns the default options used by this module.
 */
function defaultOptions(): CliOptions {
  return {
    filePath: '',
    env: {},
    format: 'step',
    out: null,
    check: false,
    build: false,
    json: false,
  };
}

/**
 * Handles arg in the current commands flow.
 */
function handleArg(
  args: string[],
  index: number,
  options: CliOptions,
): ArgHandlerResult {
  const arg = args[index];
  return (
    handleSimpleFlag(arg, index, options) ??
    handleFormat(args, index, options) ??
    handleOut(args, index, options) ??
    handleEnv(args, index, options) ??
    handlePositional(arg, index, options)
  );
}

/**
 * Handles simple flag in the current commands flow.
 */
function handleSimpleFlag(
  arg: string,
  index: number,
  options: CliOptions,
): ArgHandlerResult | null {
  if (arg === '--help' || arg === '-h')
    return { handled: true, index, error: usage() };
  if (arg === '--check') {
    options.check = true;
    return { handled: true, index };
  }
  if (arg === '--build') {
    options.build = true;
    return { handled: true, index };
  }
  if (arg === '--json') {
    options.json = true;
    return { handled: true, index };
  }
  return null;
}

/**
 * Handles format in the current commands flow.
 */
function handleFormat(
  args: string[],
  index: number,
  options: CliOptions,
): ArgHandlerResult | null {
  const arg = args[index];
  if (arg === '--format') {
    return assignFormat(args[index + 1], index + 1, options);
  }
  if (arg.startsWith('--format=')) {
    return assignFormat(arg.slice('--format='.length), index, options);
  }
  return null;
}

/**
 * Handles assign format in the commands flow.
 */
function assignFormat(
  value: string | undefined,
  index: number,
  options: CliOptions,
): ArgHandlerResult {
  if (value !== 'step' && value !== 'stl') {
    return { handled: true, index, error: `Invalid --format '${value}'` };
  }
  options.format = value;
  return { handled: true, index };
}

/**
 * Handles out in the current commands flow.
 */
function handleOut(
  args: string[],
  index: number,
  options: CliOptions,
): ArgHandlerResult | null {
  const arg = args[index];
  if (arg === '--out') {
    options.out = args[index + 1] ?? null;
    return options.out
      ? { handled: true, index: index + 1 }
      : { handled: true, index: index + 1, error: '--out requires a path' };
  }
  if (arg.startsWith('--out=')) {
    options.out = arg.slice('--out='.length);
    return { handled: true, index };
  }
  return null;
}

/**
 * Handles env in the current commands flow.
 */
function handleEnv(
  args: string[],
  index: number,
  options: CliOptions,
): ArgHandlerResult | null {
  const arg = args[index];
  if (arg === '--env' || arg === '-env') {
    const value = args[index + 1];
    if (!value)
      return {
        handled: true,
        index: index + 1,
        error: `${arg} requires name=value`,
      };
    return assignEnv(value, index + 1, options);
  }
  if (arg.startsWith('--env=')) {
    return assignEnv(arg.slice('--env='.length), index, options);
  }
  return null;
}

/**
 * Handles assign env in the commands flow.
 */
function assignEnv(
  raw: string,
  index: number,
  options: CliOptions,
): ArgHandlerResult {
  const parsed = parseEnvArg(raw);
  if (!parsed.ok) return { handled: true, index, error: parsed.error };
  options.env[parsed.name] = parsed.value;
  return { handled: true, index };
}

/**
 * Handles positional in the current commands flow.
 */
function handlePositional(
  arg: string,
  index: number,
  options: CliOptions,
): ArgHandlerResult {
  if (arg.startsWith('-'))
    return { handled: true, index, error: `Unknown option '${arg}'` };
  if (options.filePath)
    return {
      handled: true,
      index,
      error: `Unexpected extra argument '${arg}'`,
    };
  options.filePath = arg;
  return { handled: true, index };
}

/**
 * Parses env arg from the supplied source into the commands representation.
 */
function parseEnvArg(
  raw: string,
): { ok: true; name: string; value: string } | { ok: false; error: string } {
  const eq = raw.indexOf('=');
  if (eq <= 0)
    return {
      ok: false,
      error: `Invalid env override '${raw}'; expected name=value`,
    };
  const name = raw.slice(0, eq).trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name))
    return { ok: false, error: `Invalid env name '${name}'` };
  return { ok: true, name, value: raw.slice(eq + 1) };
}
