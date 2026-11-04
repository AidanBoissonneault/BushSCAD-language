import type { CliOptions, ArgHandlerResult } from '../types.js';

/**
 * Parses the --format option in separate-value and inline-value forms.
 *
 * Why:
 * Format validation is independent of file, environment, and output options.
 */
export function parseFormat(
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

/** Validates a format and stores it in the parsed CLI options. */
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
