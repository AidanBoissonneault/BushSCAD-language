import type { CliOptions, ArgHandlerResult } from '../types.js';

/** Assigns the input file path and rejects unknown flags or extra files. */
export function parsePositional(
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
