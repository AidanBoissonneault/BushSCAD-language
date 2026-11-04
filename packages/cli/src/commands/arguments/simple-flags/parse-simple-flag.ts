import type { CliOptions, ArgHandlerResult } from '../types.js';

/**
 * Handles help and boolean flags without consuming a following argument.
 *
 * Why:
 * These flags share the same argument shape and run before value-taking options.
 */
export function parseSimpleFlag(
  arg: string,
  index: number,
  options: CliOptions,
  usageMessage: string,
): ArgHandlerResult | null {
  if (arg === '--help' || arg === '-h')
    return { handled: true, index, error: usageMessage };
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
