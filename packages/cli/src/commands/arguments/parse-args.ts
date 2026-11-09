import type { CliOptions, ParsedArgs, ArgHandlerResult } from './types.js';
import { parseEnvironment } from './environment/parse-environment.js';
import { parseFormat } from './format/parse-format.js';
import { parseOutput } from './output/parse-output.js';
import { parsePositional } from './positional/parse-positional.js';
import { parseSimpleFlag } from './simple-flags/parse-simple-flag.js';

/** Returns usage text for the command-line interface. */
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
 * Parses CLI arguments into service mode, options, or a user-facing error.
 *
 * Why:
 * This function owns ordering and final validation while each option family
 * owns the syntax and state changes for its arguments.
 */
export function parseArgs(args: string[]): ParsedArgs {
  if (args[0] === '--service') return { service: true };

  const options = defaultOptions();
  for (let index = 0; index < args.length; index++) {
    const result = handleArgument(args, index, options);
    if (!result.handled)
      return { error: `Unexpected parser state at ${index}` };
    if (result.error) return { error: result.error };
    index = result.index;
  }

  if (!options.filePath) return { error: usage() };
  return options;
}

/** Creates the initial CLI options object before argument processing. */
function defaultOptions(): CliOptions {
  return {
    filePath: '',
    env: Object.create(null) as Record<string, string>,
    format: 'step',
    out: null,
    check: false,
    build: false,
    json: false,
  };
}

/** Tries option handlers in the same order as the original parser. */
function handleArgument(
  args: string[],
  index: number,
  options: CliOptions,
): ArgHandlerResult {
  const arg = args[index];
  return (
    parseSimpleFlag(arg, index, options, usage()) ??
    parseFormat(args, index, options) ??
    parseOutput(args, index, options) ??
    parseEnvironment(args, index, options) ??
    parsePositional(arg, index, options)
  );
}
